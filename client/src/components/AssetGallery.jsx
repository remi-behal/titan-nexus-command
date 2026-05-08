import React, { useEffect, useRef } from 'react';
import { SHAPES } from '../constants/ShapeDefinitions.js';
import { drawShape, drawField } from '../utils/ShapeRenderer.js';

const AssetGallery = () => {
    return (
        <div style={{ 
            background: '#050505', 
            minHeight: '100vh', 
            padding: '40px',
            color: '#00ffcc',
            fontFamily: "'Courier New', monospace",
            position: 'relative'
        }}>
            <div className="monitor-overlay" style={{
                position: 'fixed',
                top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none',
                background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)',
                backgroundSize: '100% 4px',
                zIndex: 100
            }}></div>
            
            <header style={{ 
                borderBottom: '2px solid #00ffcc', 
                marginBottom: '40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h1>TACTICAL_ASSET_GALLERY v1.0</h1>
                <a href="/" style={{ color: '#00ffcc', textDecoration: 'none', border: '1px solid #00ffcc', padding: '5px 10px' }}>
                    RETURN_TO_COMMAND_CENTER
                </a>
            </header>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                gap: '30px' 
            }}>
                {Object.keys(SHAPES).map(key => (
                    <AssetCell key={key} assetKey={key} />
                ))}
            </div>
            
            <footer style={{ marginTop: '60px', padding: '20px', borderTop: '1px solid #222', fontSize: '12px', opacity: 0.7 }}>
                <p>&gt; SYSTEM: RENDERING CORE 2.0 ACTIVE</p>
                <p>&gt; SOURCE: ShapeDefinitions.js & ShapeRenderer.js</p>
                <p>&gt; ALL ASSETS ARE VECTOR-BASED NO EXTERNAL FILES LOADED</p>
            </footer>
        </div>
    );
};

const AssetCell = ({ assetKey }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let frameId;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const time = Date.now();
            const radius = 60;
            const x = canvas.width / 2;
            const y = canvas.height / 2;

            const shape = SHAPES[assetKey];
            const color = shape.color || '#00ffcc';

            if (shape.type === 'FIELD') {
                drawField(ctx, x, y, assetKey, radius, color, false, time);
            } else {
                // Projectiles rotate
                const isProjectile = ['MISSILE', 'PROJECTILE_SMALL', 'NUKE_FLYING'].includes(assetKey);
                const rotation = isProjectile ? time / 1000 : 0;
                drawShape(ctx, x, y, assetKey, radius, color, rotation);
            }

            frameId = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(frameId);
    }, [assetKey]);

    return (
        <div style={{ 
            background: '#000', 
            border: '1px solid #333', 
            borderRadius: '4px',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            padding: '20px',
            boxShadow: '0 0 20px rgba(0,0,0,1)'
        }}>
            <canvas ref={canvasRef} width={180} height={180} />
            <div style={{ 
                fontSize: '11px', 
                marginTop: '15px', 
                color: '#00ffcc', 
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: 'bold'
            }}>
                {assetKey}
            </div>
            <div style={{ fontSize: '9px', marginTop: '5px', opacity: 0.5 }}>
                TYPE: {SHAPES[assetKey].type}
            </div>
        </div>
    );
};

export default AssetGallery;
