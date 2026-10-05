// Arazi ve çimen shader'larının paylaştığı bulut gölgesi deseni (GLSL)
export const CLOUD_GLSL = /* glsl */ `
float cloudHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cloudNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), u.x), mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float cloudShadow(vec2 xz, float t) {
  vec2 p = xz * 0.022 + vec2(t * 0.022, t * 0.008);
  float n = cloudNoise(p) * 0.65 + cloudNoise(p * 2.13 + 3.7) * 0.35;
  return smoothstep(0.47, 0.62, n);
}
`
