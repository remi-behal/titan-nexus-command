import React, { useState } from 'react';
import './RadialMenu.css';
import { ENTITY_STATS } from '../../../shared/constants/EntityStats.js';
import { SHAPES } from '../constants/ShapeDefinitions.js';

const CATEGORIES = ['OFFENSE', 'DEFENSE', 'UTILITY', 'SPECIAL'];

const CATEGORY_ICONS = {
    OFFENSE: 'WEAPON',
    DEFENSE: 'SHIELD',
    UTILITY: 'HUB',
    SPECIAL: 'OVERLOAD'
};

const DISPLAY_NAMES = {
    LASER_POINT_DEFENSE: 'L.P.D.',
    LIGHT_SAM_DEFENSE: 'SAM',
    SMART_SAM_DEFENSE: 'S-SAM',
    FLAK_DEFENSE: 'FLAK',
    CLOAKING_FIELD: 'CLOAK',
    ECHO_ARTILLERY: 'ECHO',
    CLUSTER_BOMB: 'CLUSTER',
    HOMING_MISSILE: 'HOMING',
    EXTRACTOR: 'EXTRACT',
    RECLAIMER: 'RECLAIM'
};

const getDisplayName = (type) => {
    return DISPLAY_NAMES[type] || type;
};

const getShapeKey = (itemType) => {
    if (itemType === 'HOMING_MISSILE') return 'MISSILE';
    if (itemType === 'NUKE') return 'NUKE_FLYING';
    return itemType;
};

const EntityIcon = ({ itemType, scale = 12 }) => {
    const shapeKey = getShapeKey(itemType);
    const shape = SHAPES[shapeKey];
    if (!shape) return null;

    const layers = shape.layers || 1;
    const bracingLines = [];
    if (shape.bracing) {
        const len = shape.points.length;
        const halfLen = Math.floor(len / 2);
        for (let i = 0; i < halfLen; i++) {
            const p1 = shape.points[i];
            const p2 = shape.points[i + halfLen];
            bracingLines.push(
                <line
                    key={`brace-${i}`}
                    x1={p1[0] * scale}
                    y1={p1[1] * scale}
                    x2={p2[0] * scale}
                    y2={p2[1] * scale}
                    stroke="currentColor"
                    strokeWidth={0.8}
                    opacity={0.6}
                />
            );
        }
    }

    const paths = [];
    if (shape.type === 'PATH') {
        for (let l = 1; l <= layers; l++) {
            const r = scale * (l / layers);
            const pathParts = shape.points.map(([px, py], i) => {
                const command = i === 0 ? 'M' : 'L';
                return `${command} ${px * r} ${py * r}`;
            });
            if (shape.closed) pathParts.push('Z');
            const d = pathParts.join(' ');
            paths.push(
                <path
                    key={`layer-${l}`}
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={l === layers ? 1.5 : 0.8}
                />
            );
        }
    }

    let symbolEl = null;
    if (shape.symbol === 'RADIATION') {
        const r = scale * 0.6;
        const arcs = [];
        for (let i = 0; i < 3; i++) {
            const startA = (i * 120 - 30) * (Math.PI / 180);
            const endA = (i * 120 + 30) * (Math.PI / 180);
            const xStart = Math.cos(startA) * r * 0.8;
            const yStart = Math.sin(startA) * r * 0.8;
            const xEnd = Math.cos(endA) * r * 0.8;
            const yEnd = Math.sin(endA) * r * 0.8;
            arcs.push(
                <path
                    key={`rad-arc-${i}`}
                    d={`M 0 0 L ${xStart} ${yStart} A ${r * 0.8} ${r * 0.8} 0 0 1 ${xEnd} ${yEnd} Z`}
                    fill="currentColor"
                />
            );
        }
        symbolEl = (
            <g>
                <circle cx="0" cy="0" r={r * 0.2} fill="currentColor" />
                {arcs}
            </g>
        );
    } else if (shape.symbol === 'CORE') {
        const r = scale * 0.6;
        symbolEl = (
            <g>
                <circle cx="0" cy="0" r={r * 0.3} fill="currentColor" opacity={0.4} stroke="currentColor" strokeWidth={1} />
            </g>
        );
    }

    return (
        <g className="entity-icon-svg">
            {bracingLines}
            {paths}
            {symbolEl}
        </g>
    );
};

const RadialMenu = ({ x, y, onSelect, onCancel, playerEnergy, hubFuel }) => {
    const [currentCategory, setCurrentCategory] = useState(null);

    const getItemsInCategory = (cat) => {
        return Object.entries(ENTITY_STATS)
            .filter(([, stats]) => stats.category === cat)
            .map(([type, stats]) => ({ ...stats, type }));
    };

    const handleCategoryClick = (cat) => {
        setCurrentCategory(cat);
    };

    const handleItemClick = (type) => {
        onSelect(type);
    };

    const handleBack = () => {
        setCurrentCategory(null);
    };

    const renderRing = () => {
        const items = currentCategory ? getItemsInCategory(currentCategory) : CATEGORIES;
        const count = items.length;
        const angleStep = (2 * Math.PI) / count;
        const outerRadius = 120;
        const innerRadius = 50;

        return items.map((item, i) => {
            const startAngle = i * angleStep - Math.PI / 2;
            const endAngle = (i + 1) * angleStep - Math.PI / 2;

            // Path for the segment
            const x1 = Math.cos(startAngle) * outerRadius;
            const y1 = Math.sin(startAngle) * outerRadius;
            const x2 = Math.cos(endAngle) * outerRadius;
            const y2 = Math.sin(endAngle) * outerRadius;
            const x3 = Math.cos(endAngle) * innerRadius;
            const y3 = Math.sin(endAngle) * innerRadius;
            const x4 = Math.cos(startAngle) * innerRadius;
            const y4 = Math.sin(startAngle) * innerRadius;

            const pathData = `
                M ${x1} ${y1}
                A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2}
                L ${x3} ${y3}
                A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}
                Z
            `;

            const isCategory = !currentCategory;
            const displayName = isCategory ? item : getDisplayName(item.type);
            const iconType = isCategory ? CATEGORY_ICONS[item] : item.type;
            const itemKey = isCategory ? item : item.type;
            const isAffordable = isCategory ? true : playerEnergy >= item.cost;
            const isDisabled = !isCategory && (!isAffordable || hubFuel <= 0);

            const midAngle = startAngle + angleStep / 2;
            const cos = Math.cos(midAngle);
            const sin = Math.sin(midAngle);

            const rIcon = isCategory ? 75 : 78;
            const rText = isCategory ? 98 : 100;
            const rCost = 60;

            const xIcon = cos * rIcon;
            const yIcon = sin * rIcon;
            const xText = cos * rText;
            const yText = sin * rText;
            const xCost = cos * rCost;
            const yCost = sin * rCost;

            return (
                <g
                    key={itemKey}
                    className={`menu-segment ${isDisabled ? 'disabled' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isDisabled) return;
                        if (currentCategory) {
                            handleItemClick(item.type);
                        } else {
                            handleCategoryClick(item);
                        }
                    }}
                >
                    <path d={pathData} />
                    
                    {/* Vector shape icon */}
                    <g transform={`translate(${xIcon}, ${yIcon})`}>
                        <EntityIcon itemType={iconType} scale={12} />
                    </g>

                    {/* Text Label */}
                    <text
                        x={xText}
                        y={yText}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="name-text"
                    >
                        {displayName}
                    </text>

                    {/* Energy Cost (only for items) */}
                    {!isCategory && (
                        <text
                            x={xCost}
                            y={yCost}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="cost-text"
                        >
                            {item.cost}E
                        </text>
                    )}
                </g>
            );
        });
    };

    return (
        <div
            className="radial-menu-container"
            style={{ left: x, top: y }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <svg width="300" height="300" viewBox="-150 -150 300 300">
                <circle
                    cx="0"
                    cy="0"
                    r="45"
                    className="menu-center"
                    onClick={currentCategory ? handleBack : onCancel}
                />
                <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    className="center-icon"
                    onClick={currentCategory ? handleBack : onCancel}
                >
                    {currentCategory ? '←' : '✕'}
                </text>
                {renderRing()}
            </svg>
        </div>
    );
};

export default RadialMenu;
