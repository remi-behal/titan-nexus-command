import React, { useState } from 'react';
import './RadialMenu.css';
import { ENTITY_STATS } from '../../../shared/constants/EntityStats.js';

const CATEGORIES = ['OFFENSE', 'DEFENSE', 'UTILITY', 'SPECIAL'];

const RadialMenu = ({ x, y, onSelect, onCancel, playerEnergy, hubFuel }) => {
    const [currentCategory, setCurrentCategory] = useState(null);

    // Filter items by category
    const getItemsInCategory = (cat) => {
        return Object.entries(ENTITY_STATS)
            .filter(([, stats]) => stats.category === cat)
            .map(([type, stats]) => ({ type, ...stats }));
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

            const label = currentCategory ? item.type : item;
            const isAffordable = currentCategory ? playerEnergy >= item.cost : true;
            // hubFuel <= 0 is only relevant for non-HUB structures that require a hub to launch
            // But since the menu is ON a hub, we check that hub's fuel.
            const isDisabled = currentCategory && (!isAffordable || hubFuel <= 0);

            return (
                <g
                    key={label}
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
                    <text
                        x={Math.cos(startAngle + angleStep / 2) * (innerRadius + (outerRadius - innerRadius) / 2)}
                        y={Math.sin(startAngle + angleStep / 2) * (innerRadius + (outerRadius - innerRadius) / 2)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {label.length > 10 ? label.substring(0, 8) + '...' : label}
                    </text>
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
                <circle cx="0" cy="0" r="45" className="menu-center" onClick={currentCategory ? handleBack : onCancel} />
                <text x="0" y="5" textAnchor="middle" className="center-icon" onClick={currentCategory ? handleBack : onCancel}>
                    {currentCategory ? '←' : '✕'}
                </text>
                {renderRing()}
            </svg>
        </div>
    );
};

export default RadialMenu;
