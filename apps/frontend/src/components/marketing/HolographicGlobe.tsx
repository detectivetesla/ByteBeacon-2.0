import React, { useEffect, useRef, useState } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export const HolographicGlobe: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationAngle = 0;

    // Generate sphere points
    const spherePoints: Point3D[] = [];
    const numLatitudes = 14;
    const numLongitudes = 24;
    const radius = 130;

    for (let i = 0; i <= numLatitudes; i++) {
      const theta = (i * Math.PI) / numLatitudes;
      for (let j = 0; j < numLongitudes; j++) {
        const phi = (j * 2 * Math.PI) / numLongitudes;
        spherePoints.push({
          x: radius * Math.sin(theta) * Math.cos(phi),
          y: radius * Math.cos(theta),
          z: radius * Math.sin(theta) * Math.sin(phi),
        });
      }
    }

    // Carrier data packets on orbital tracks
    const carrierOrbits = [
      { color: '#FFCC00', speed: 0.02, angle: 0, radius: 155, inclination: 0.35, label: 'MTN' },
      { color: '#E7192D', speed: 0.016, angle: 2.1, radius: 165, inclination: -0.4, label: 'Telecel' },
      { color: '#0066B2', speed: 0.024, angle: 4.2, radius: 175, inclination: 0.6, label: 'AT' },
    ];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Dampened rotation with subtle mouse parallax
      if (!reducedMotion) {
        rotationAngle += 0.008;
      }
      const targetAngleY = rotationAngle + mousePos.x * 0.25;
      const targetAngleX = mousePos.y * 0.2;

      const cosY = Math.cos(targetAngleY);
      const sinY = Math.sin(targetAngleY);
      const cosX = Math.cos(targetAngleX);
      const sinX = Math.sin(targetAngleX);

      // Ambient Central Core Glow
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius * 1.4);
      coreGradient.addColorStop(0, 'rgba(34, 197, 94, 0.22)');
      coreGradient.addColorStop(0.4, 'rgba(2, 132, 199, 0.12)');
      coreGradient.addColorStop(0.8, 'rgba(139, 92, 246, 0.04)');
      coreGradient.addColorStop(1, 'rgba(7, 11, 20, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Draw wireframe latitude rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Render 3D Sphere Points
      spherePoints.forEach((pt) => {
        // Y-axis rotation
        const x1 = pt.x * cosY - pt.z * sinY;
        const z1 = pt.z * cosY + pt.x * sinY;

        // X-axis tilt
        const y2 = pt.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + pt.y * sinX;

        // Perspective projection
        const depthFactor = (z2 + radius) / (radius * 2); // 0 to 1
        const scale = (depthFactor * 0.6 + 0.7);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;

        if (z2 > -radius * 0.8) {
          const alpha = Math.max(0.08, depthFactor * 0.65);
          ctx.fillStyle = depthFactor > 0.6 ? `rgba(74, 222, 128, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(projX, projY, depthFactor > 0.7 ? 1.8 : 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Render Carrier Data Orbit Streams
      carrierOrbits.forEach((orbit) => {
        if (!reducedMotion) {
          orbit.angle += orbit.speed;
        }

        // Elliptical inclined orbit
        const orbX = orbit.radius * Math.cos(orbit.angle);
        const orbZ = orbit.radius * Math.sin(orbit.angle);
        const orbY = orbZ * Math.sin(orbit.inclination);

        const rx = orbX * cosY - orbZ * cosX * sinY;
        const rz = orbZ * cosY + orbX * sinY;
        const ry = orbY * cosX - rz * sinX;

        const orbDepth = (rz + orbit.radius) / (orbit.radius * 2);
        const orbProjX = centerX + rx;
        const orbProjY = centerY + ry;

        // Orbit trail
        ctx.beginPath();
        ctx.arc(orbProjX, orbProjY, orbDepth > 0.5 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = orbit.color;
        ctx.shadowColor = orbit.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // Ghana Regional Gateway Node (Lat: 5.6°N, Long: 0.19°W)
      const ghanaTheta = Math.PI / 2.1;
      const ghanaPhi = Math.PI * 0.85;
      const ghX = radius * Math.sin(ghanaTheta) * Math.cos(ghanaPhi);
      const ghY = radius * Math.cos(ghanaTheta);
      const ghZ = radius * Math.sin(ghanaTheta) * Math.sin(ghanaPhi);

      const ghRotX = ghX * cosY - ghZ * sinY;
      const ghRotZ = ghZ * cosY + ghX * sinY;
      const ghRotY = ghY * cosX - ghRotZ * sinX;

      if (ghRotZ > -30) {
        const ghScale = (ghRotZ + radius) / (radius * 2) * 0.6 + 0.7;
        const ghProjX = centerX + ghRotX * ghScale;
        const ghProjY = centerY + ghRotY * ghScale;

        // Glowing Hub Ring
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ghProjX, ghProjY, 7 + Math.sin(rotationAngle * 3) * 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ghProjX, ghProjY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#4ADE80';
        ctx.fillText('Accra Core Hub (GH)', ghProjX + 12, ghProjY + 3);
      }

      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mousePos, reducedMotion]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '460px',
        height: '400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={460}
        height={400}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '460px',
          maxHeight: '400px',
          display: 'block',
        }}
      />
    </div>
  );
};
