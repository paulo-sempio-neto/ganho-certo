import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
varying vec2 vUv;

// Função clássica de Simplex Noise 2D para efeitos orgânicos
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  
  // Anima as coordenadas de ruído pelo tempo para fluidez
  float noise1 = snoise(uv * 3.0 + u_time * 0.15);
  float noise2 = snoise(uv * 2.0 - u_time * 0.1 + noise1 * 0.8);
  
  // Mistura para formas líquidas complexas
  float finalNoise = snoise(uv * 3.5 + noise2);
  
  // Mapeia o ruído em níveis de intensidade
  float intensity = smoothstep(-0.4, 0.8, finalNoise);
  
  // Cores: Preto Absoluto -> Verde Neon -> Brilho Esmeralda Intenso
  vec3 colorBlack = vec3(0.02, 0.04, 0.02);
  vec3 colorGreen = vec3(0.0, 0.6, 0.2);
  vec3 colorNeon  = vec3(0.1, 1.0, 0.4);
  
  vec3 finalColor = mix(colorBlack, colorGreen, intensity);
  
  // Adiciona os highlights de alto brilho nas cristas das "ondas"
  finalColor = mix(finalColor, colorNeon, smoothstep(0.7, 1.0, intensity));
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function FluidPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = state.clock.elapsedTime;
    }
  });

  const uniforms = useMemo(() => ({ u_time: { value: 0 } }), []);

  return (
    <mesh>
      {/* Um plano largo o suficiente para cobrir qualquer tela sem distorções severas de borda */}
      <planeGeometry args={[30, 20, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      
      {/* O Canvas do WebGL rodando o Shader a 60fps */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <FluidPlane />
        </Canvas>
      </div>

      {/* Máscara em Degradê Preto (Esquerda para Direita) 
          Garante que o texto do lado esquerdo continue hiper legível,
          enquanto a direita brilha na transição para o card */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/30 to-transparent" />
      
      {/* Textura Film Grain overlay para finalização cinematográfica premium */}
      <div 
        className="absolute inset-0 z-20 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

    </div>
  );
}

