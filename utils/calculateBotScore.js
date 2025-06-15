function calculateBotScore(data) {
    console.log("DATA RECEIVED IN CALCUL :", JSON.stringify(data));
  let score = 0;

  // Example heuristics (tune as needed)
  if (data.isHeadless) score += 40;
  if (!data.canvasFingerprint) score += 20;
  if (data.mouseEntropy !== null && data.mouseEntropy < 2) score += 20;
  if (data.timeToFirstInteraction !== null && data.timeToFirstInteraction > 10) score += 10;
  if ((data.plugins || []).length === 0) score += 10;
  // Clamp score to 100
  return Math.min(100, score);
}

module.exports = {calculateBotScore};