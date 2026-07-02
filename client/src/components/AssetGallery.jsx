import React, { useEffect, useRef } from 'react';
import { SHAPES } from '../constants/ShapeDefinitions.js';
import { drawShape, drawField } from '../utils/ShapeRenderer.js';

const AssetGallery = () => {
    return (
        <div className="tactical-gallery-container">
            <style>{`
                /* Main Page layout and Cyber Scrollbar */
                .tactical-gallery-container {
                    background: radial-gradient(circle at 50% 50%, #0d1211 0%, #030505 100%);
                    min-height: 100vh;
                    padding: 40px;
                    color: #00ffcc;
                    font-family: 'Courier New', Courier, monospace;
                    position: relative;
                    overflow-x: hidden;
                    overflow-y: auto;
                    box-sizing: border-box;
                }

                /* Scrollbar overrides */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #030505;
                    border-left: 1px solid #112220;
                }
                ::-webkit-scrollbar-thumb {
                    background: #005544;
                    border-radius: 4px;
                    border: 1px solid #00221a;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #00ffcc;
                    box-shadow: 0 0 10px #00ffcc;
                }

                /* Monitor scanline overlay */
                .monitor-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none;
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%);
                    background-size: 100% 4px;
                    z-index: 100;
                }

                /* Header Area styling */
                .gallery-header {
                    border-bottom: 2px solid #00ffcc;
                    margin-bottom: 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 15px;
                    text-shadow: 0 0 8px rgba(0, 255, 204, 0.4);
                }

                .gallery-header h1 {
                    font-size: 1.8rem;
                    margin: 0;
                    letter-spacing: 3px;
                    font-weight: 900;
                }

                /* Premium return button */
                .return-btn {
                    color: #00ffcc;
                    text-decoration: none;
                    border: 1px solid #00ffcc;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: bold;
                    letter-spacing: 1px;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    background: rgba(0, 255, 204, 0.03);
                    box-shadow: 0 0 5px rgba(0, 255, 204, 0.1);
                    text-transform: uppercase;
                }

                .return-btn:hover {
                    background: #00ffcc;
                    color: #000;
                    box-shadow: 0 0 20px #00ffcc, inset 0 0 5px rgba(255, 255, 255, 0.5);
                    transform: translateY(-2px);
                }

                /* Asset Grid */
                .gallery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 30px;
                    box-sizing: border-box;
                }

                /* Sleek interactive Glassmorphic Cards */
                .asset-cell {
                    background: rgba(0, 0, 0, 0.65);
                    border: 1px solid #1a332d;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 25px 20px;
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }

                .asset-cell::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 2px;
                    background: linear-gradient(90deg, transparent, #00ffcc, transparent);
                    transform: scaleX(0);
                    transition: transform 0.4s ease;
                }

                .asset-cell:hover {
                    transform: translateY(-6px);
                    border-color: #00ffcc;
                    box-shadow: 0 12px 40px rgba(0, 255, 204, 0.15);
                }

                .asset-cell:hover::before {
                    transform: scaleX(1);
                }

                .asset-cell canvas {
                    filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.3));
                    transition: filter 0.3s ease;
                }

                .asset-cell:hover canvas {
                    filter: drop-shadow(0 0 12px rgba(0, 255, 204, 0.7));
                }

                .asset-title {
                    font-size: 0.75rem;
                    margin-top: 20px;
                    color: #00ffcc;
                    text-transform: uppercase;
                    letter-spacing: 2.5px;
                    font-weight: 700;
                    text-align: center;
                    text-shadow: 0 0 5px rgba(0, 255, 204, 0.3);
                }

                .asset-subtitle {
                    font-size: 0.6rem;
                    margin-top: 8px;
                    opacity: 0.55;
                    letter-spacing: 1px;
                }

                /* Footer */
                .gallery-footer {
                    margin-top: 80px;
                    padding: 30px 20px;
                    border-top: 1px solid #152522;
                    font-size: 0.7rem;
                    opacity: 0.65;
                    line-height: 1.6;
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .footer-column {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
            `}</style>

            <div className="monitor-overlay"></div>

            <header className="gallery-header">
                <h1>TACTICAL_ASSET_GALLERY v1.0</h1>
                <a href="/" className="return-btn">
                    RETURN_TO_COMMAND_CENTER
                </a>
            </header>

            <div className="gallery-grid">
                {Object.keys(SHAPES).map((key) => (
                    <AssetCell key={key} assetKey={key} />
                ))}
            </div>

            <footer className="gallery-footer">
                <div className="footer-column">
                    <p>&gt; SYSTEM: RENDERING CORE 2.0 ACTIVE</p>
                    <p>&gt; SOURCE: ShapeDefinitions.js & ShapeRenderer.js</p>
                </div>
                <div className="footer-column" style={{ textAlign: 'right' }}>
                    <p>&gt; VECTOR SYNTAX: HULL-LINKING & ROTATION ACTIVE</p>
                    <p>&gt; ZERO EXTERNAL ASSET DEPENDENCY (ALL CORE RENDERED)</p>
                </div>
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
                const isProjectile = ['MISSILE', 'PROJECTILE_SMALL', 'NUKE_FLYING'].includes(
                    assetKey
                );
                const rotation = isProjectile ? time / 1000 : 0;
                drawShape(ctx, x, y, assetKey, radius, color, rotation);
            }

            frameId = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(frameId);
    }, [assetKey]);

    return (
        <div className="asset-cell">
            <canvas ref={canvasRef} width={180} height={180} />
            <div className="asset-title">{assetKey}</div>
            <div className="asset-subtitle">TYPE: {SHAPES[assetKey].type}</div>
        </div>
    );
};

export default AssetGallery;
