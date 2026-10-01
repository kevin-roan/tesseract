import { Skia } from "@shopify/react-native-skia";

const source = `
uniform float2 size;
uniform float time;
uniform float4 warm;
uniform float4 cool;

half4 main(float2 pos) {
  float2 uv = (pos - size * 0.5) / (min(size.x, size.y) * 0.5);
  float2 drift = 0.07 * float2(sin(time * 0.6 + uv.y * 2.3), cos(time * 0.8 + uv.x * 2.1));
  float2 p = uv + drift;
  float glow = smoothstep(1.0, 0.0, length(p * float2(1.0, 1.06)));
  glow = glow * glow * (3.0 - 2.0 * glow);
  float blend = clamp(0.5 + 0.45 * (0.55 * p.x + 0.85 * p.y) + 0.12 * sin(time * 0.5), 0.0, 1.0);
  float3 color = mix(warm.rgb, cool.rgb, blend);
  float alpha = glow * 0.92;
  return half4(color * alpha, alpha);
}
`;

export const auraShader = Skia.RuntimeEffect.Make(source);
