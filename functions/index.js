// Hotel Planner — Firebase Cloud Function
// Proxies Google Gemini AI requests to keep the API key secure server-side.
// Deploy: firebase deploy --only functions

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini API key — stored as a Firebase Secret (never exposed to client)
// Set with: firebase functions:secrets:set GEMINI_API_KEY
const geminiKey = defineSecret("GEMINI_API_KEY");

exports.generateFloorLayout = onCall(
  {
    secrets: [geminiKey],
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    // Require anonymous or authenticated user
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { layoutData } = request.data;
    if (!layoutData || !layoutData.buildableBbox) {
      throw new HttpsError("invalid-argument", "layoutData가 필요합니다.");
    }

    let parsed;
    try {
      const genAI = new GoogleGenerativeAI(geminiKey.value());
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const prompt = buildLayoutPrompt(layoutData);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI 응답에서 JSON을 파싱할 수 없습니다.");
        parsed = JSON.parse(match[0]);
      }
    } catch (err) {
      console.error("Gemini API error:", err);
      throw new HttpsError("internal", "AI 요청 실패: " + err.message);
    }

    // Validate response structure
    if (!parsed.corePlacements || !parsed.roomPlacements) {
      throw new HttpsError("internal", "AI 응답 형식이 올바르지 않습니다.");
    }

    return parsed;
  }
);

/**
 * Build a detailed prompt for hotel floor plan layout.
 * @param {object} d - layoutData from client
 */
function buildLayoutPrompt(d) {
  const { buildableBbox, coreGroups, roomTypes, targetArea_m2, snapMm } = d;
  const snap = snapMm || 100;
  const bx0 = buildableBbox.x_min;
  const by0 = buildableBbox.y_min;
  const bx1 = buildableBbox.x_max;
  const by1 = buildableBbox.y_max;
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  const cx = Math.round((bx0 + bx1) / 2 / snap) * snap;
  const cy = Math.round((by0 + by1) / 2 / snap) * snap;

  const coreList = coreGroups.map((c) =>
    `  Core[${c.groupIdx}]: ${c.w_mm}×${c.h_mm}mm` +
    ` (${(c.w_mm / 1000).toFixed(1)}m × ${(c.h_mm / 1000).toFixed(1)}m)`
  ).join("\n");

  const roomList = roomTypes.map((r) =>
    `  Type "${r.id}": width=${r.w_mm}mm, depth=${r.d_mm}mm` +
    ` (${(r.w_mm / 1000).toFixed(1)}m × ${(r.d_mm / 1000).toFixed(1)}m)`
  ).join("\n");

  // Compute how many rooms fit per row for the reference room type
  const refRoom = roomTypes[0] || { w_mm: 4500, d_mm: 9000 };
  const roomsPerRow = Math.floor(bw / refRoom.w_mm);
  const topRowY = by0;
  const bottomRowY = Math.round((by1 - refRoom.d_mm) / snap) * snap;
  const coreX = Math.round((cx - (coreGroups[0]?.w_mm || 6000) / 2) / snap) * snap;
  const coreY = Math.round((cy - (coreGroups[0]?.h_mm || 8000) / 2) / snap) * snap;

  // Build example room coordinates for the prompt
  const exampleTopRooms = [];
  for (let i = 0; i < Math.min(3, roomsPerRow); i++) {
    exampleTopRooms.push(
      `{"typeId":"${refRoom.id}","x_mm":${bx0 + i * refRoom.w_mm},"y_mm":${topRowY},"rotation":0}`
    );
  }
  const exampleBottomRooms = [];
  for (let i = 0; i < Math.min(3, roomsPerRow); i++) {
    exampleBottomRooms.push(
      `{"typeId":"${refRoom.id}","x_mm":${bx0 + i * refRoom.w_mm},"y_mm":${bottomRowY},"rotation":180}`
    );
  }

  return `You are a hotel floor plan layout AI. Generate an optimal layout for a standard hotel guest floor.

COORDINATE SYSTEM:
- All values in millimeters (mm), integers only
- Canvas origin (0,0) is at top-left; X increases rightward, Y increases downward
- Snap grid: ${snap}mm — every x_mm and y_mm MUST be an exact multiple of ${snap}

BUILDABLE AREA (keep all elements fully inside):
  x: [${bx0}, ${bx1}]  (width = ${bw}mm = ${(bw / 1000).toFixed(1)}m)
  y: [${by0}, ${by1}]  (height = ${bh}mm = ${(bh / 1000).toFixed(1)}m)
  center: (${cx}, ${cy})
  Target hotel area to fill: ${targetArea_m2} m²

ELEMENTS TO PLACE:
Cores — ALL must be placed:
${coreList}

Room Types — place as many as needed to approach ${targetArea_m2}m²:
${roomList}

LAYOUT RULES (follow strictly):
1. CORE PLACEMENT — center the core on the floor:
   x_mm = ${coreX}  (core left edge so core is horizontally centered)
   y_mm = ${coreY}  (core top edge so core is vertically centered)
   If multiple cores exist, place them side-by-side horizontally from the center.

2. ROOM PLACEMENT — double-loaded corridor:
   TOP ROW (rotation=0, glass/window at top = exterior side):
     y_mm = ${topRowY}
     Start at x_mm = ${bx0}, increment by room width, stop before ${bx1}
     Skip positions that would overlap the core bounding box

   BOTTOM ROW (rotation=180, glass/window at bottom = exterior side):
     y_mm = ${bottomRowY}
     Same x pattern as top row, skip core overlap

   If target area not yet met after two rows, add more rows inward from
   top (y += room_depth) and bottom (y -= room_depth), avoiding core overlap.

3. COLLISION RULE: No two elements may overlap.
   Core occupies: x=[${coreX}, ${coreX + (coreGroups[0]?.w_mm || 6000)}], y=[${coreY}, ${coreY + (coreGroups[0]?.h_mm || 8000)}]
   Skip any room placement that intersects the core bounding box.

4. BOUNDARY RULE: Every element must stay within x=[${bx0},${bx1}] and y=[${by0},${by1}].
   A room at (x,y) with rotation=0 occupies x to x+width and y to y+depth.
   A room at (x,y) with rotation=90/270 occupies x to x+depth and y to y+width.

RESPOND WITH ONLY VALID JSON — no markdown, no explanation outside the JSON object:
{
  "corePlacements": [
    {"groupIdx": 0, "x_mm": ${coreX}, "y_mm": ${coreY}}
  ],
  "roomPlacements": [
    ${exampleTopRooms.join(",\n    ")},
    ${exampleBottomRooms.join(",\n    ")}
  ],
  "strategy": "코어를 중앙에 배치하고 double-loaded corridor 방식으로 객실을 상하에 배치했습니다."
}`;
}
