use strict;
use warnings;
use IO::Socket::INET;
use HTTP::Tiny;
use JSON::PP qw(encode_json decode_json);

my $port = 8765;
my $root = $ARGV[0] || '.';

use Cwd 'abs_path';
use FindBin qw($Bin);
$root = abs_path($root) if -d $root;

# ── Load Gemini API key from api.key (project root, not served as static file) ──
my $api_key = '';
my $key_file = "$Bin/api.key";
if (-f $key_file) {
  open my $kf, '<', $key_file or die "Cannot open $key_file: $!";
  $api_key = <$kf>; chomp $api_key;
  close $kf;
  print "Gemini API key loaded.\n";
} else {
  print "WARNING: api.key not found at $key_file — AI layout will not work.\n";
}

my %mime = (
  html  => 'text/html; charset=utf-8',
  css   => 'text/css',
  js    => 'application/javascript',
  png   => 'image/png',
  jpg   => 'image/jpeg',
  jpeg  => 'image/jpeg',
  svg   => 'image/svg+xml',
  ico   => 'image/x-icon',
  json  => 'application/json',
  woff2 => 'font/woff2',
  woff  => 'font/woff',
  ttf   => 'font/ttf',
);

my $CORS = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n";

my $server = IO::Socket::INET->new(
  LocalPort => $port,
  Type      => SOCK_STREAM,
  Reuse     => 1,
  Listen    => 50,
) or die "Cannot create server on port $port: $!\n";

print "Serving $root on port $port\n";
$| = 1;

while (my $client = $server->accept()) {
  $client->autoflush(1);

  # ── Read request line + headers ──────────────────────────────────────
  my ($method, $path, %headers) = ('', '');
  eval {
    local $SIG{ALRM} = sub { die "timeout\n" };
    alarm 10;
    my $first = <$client>;
    if ($first && $first =~ /^(GET|POST|OPTIONS)\s+([^\s?]+)/) {
      ($method, $path) = ($1, $2);
    }
    while (my $line = <$client>) {
      last if $line eq "\r\n" || $line eq "\n";
      if ($line =~ /^([^:]+):\s*(.+)\r?\n$/) {
        $headers{lc($1)} = $2;
      }
    }
    alarm 0;
  };

  $path //= '';
  $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;

  # ── CORS preflight ────────────────────────────────────────────────────
  if ($method eq 'OPTIONS') {
    print $client "HTTP/1.0 204 No Content\r\n${CORS}\r\n";
    close $client; next;
  }

  # ── POST /api/ai-layout  →  Gemini proxy ─────────────────────────────
  if ($method eq 'POST' && $path eq '/api/ai-layout') {
    unless ($api_key) {
      my $err = encode_json({ error => 'api.key not configured' });
      print $client "HTTP/1.0 503 Service Unavailable\r\nContent-Type: application/json\r\n${CORS}Content-Length: ".length($err)."\r\n\r\n$err";
      close $client; next;
    }

    # Read request body
    my $body = '';
    my $clen = $headers{'content-length'} // 0;
    if ($clen > 0) {
      eval {
        local $SIG{ALRM} = sub { die "timeout\n" };
        alarm 15;
        read($client, $body, $clen);
        alarm 0;
      };
    }

    my $req_data = eval { decode_json($body) } // {};
    my $prompt   = $req_data->{prompt} // '';

    if (!$prompt) {
      my $err = encode_json({ error => 'prompt is required' });
      print $client "HTTP/1.0 400 Bad Request\r\nContent-Type: application/json\r\n${CORS}Content-Length: ".length($err)."\r\n\r\n$err";
      close $client; next;
    }

    # Call Gemini API — try gemini-2.5-flash-lite first (fast), fall back to gemini-2.5-flash
    my $gemini_body = encode_json({
      contents         => [{ parts => [{ text => $prompt }] }],
      generationConfig => { temperature => 0.2, responseMimeType => 'application/json' },
    });
    my $ua = HTTP::Tiny->new(timeout => 30, verify_SSL => 0);
    my $res;
    for my $model ('gemini-2.5-flash-lite', 'gemini-2.5-flash') {
      my $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$api_key";
      $res = $ua->request('POST', $url, {
        headers => { 'Content-Type' => 'application/json' },
        content => $gemini_body,
      });
      last unless !$res->{success} && ($res->{status} == 503 || $res->{status} == 429);
      print "Model $model returned $res->{status}, trying fallback...\n";
    }

    if ($res->{success}) {
      my $result   = eval { decode_json($res->{content}) } // {};
      my $ai_text  = $result->{candidates}[0]{content}{parts}[0]{text} // '{}';
      my $response = encode_json({ text => $ai_text });
      print $client "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n${CORS}Content-Length: ".length($response)."\r\n\r\n$response";
    } else {
      my $err = encode_json({ error => $res->{status}.' '.$res->{reason}, detail => $res->{content} });
      print $client "HTTP/1.0 502 Bad Gateway\r\nContent-Type: application/json\r\n${CORS}Content-Length: ".length($err)."\r\n\r\n$err";
    }
    close $client; next;
  }

  # ── GET static files ─────────────────────────────────────────────────
  if ($method eq 'GET') {
    $path = '/index.html' if $path eq '/';
    $path =~ s{^/}{};
    $path =~ s{\.\.}{}g;
    my $file = "$root/$path";

    if (-f $file) {
      my ($ext) = $file =~ /\.([^.]+)$/;
      my $ct = $mime{lc($ext // '')} // 'application/octet-stream';
      open my $fh, '<:raw', $file or do {
        print $client "HTTP/1.0 500 Error\r\nContent-Type: text/plain\r\n\r\nCannot open file";
        close $client; next;
      };
      local $/;
      my $body = <$fh>;
      close $fh;
      my $len = length($body);
      print $client "HTTP/1.0 200 OK\r\nContent-Type: $ct\r\nContent-Length: $len\r\n${CORS}\r\n$body";
    } else {
      my $msg = "Not Found: $path";
      print $client "HTTP/1.0 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: ".length($msg)."\r\n\r\n$msg";
    }
  }

  close $client;
}
