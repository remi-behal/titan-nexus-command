import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RadialMenu from './RadialMenu.jsx';
import { ENTITY_STATS } from '../../../shared/constants/EntityStats.js';

describe('RadialMenu Component', () => {
    it('renders category ring initially and handles navigation', () => {
        const mockSelect = vi.fn();
        const mockCancel = vi.fn();

        render(
            <RadialMenu
                x={100}
                y={100}
                onSelect={mockSelect}
                onCancel={mockCancel}
                playerEnergy={100}
                hubFuel={10}
            />
        );

        // Check if categories are rendered in initial view
        expect(screen.getByText('OFFENSE')).toBeDefined();
        expect(screen.getByText('DEFENSE')).toBeDefined();
        expect(screen.getByText('UTILITY')).toBeDefined();
        expect(screen.getByText('SPECIAL')).toBeDefined();

        // Click on OFFENSE category
        fireEvent.click(screen.getByText('OFFENSE'));

        // Now categories are not visible, but OFFENSE items are visible
        expect(screen.queryByText('DEFENSE')).toBeNull();

        // Let's verify that items under OFFENSE are displayed using their display names
        expect(screen.getByText('WEAPON')).toBeDefined();
        expect(screen.getByText('CLUSTER')).toBeDefined();

        // Click the center area to go back (currently shows '←' when in category)
        fireEvent.click(screen.getByText('←'));

        // We should be back in the category list
        expect(screen.getByText('DEFENSE')).toBeDefined();
    });

    it('falls back to the text (item.type) when symbol is undefined', () => {
        const mockSelect = vi.fn();
        const mockCancel = vi.fn();

        // Let's temporarily delete the symbol for NAPALM to test fallback logic
        const originalNapalmSymbol = ENTITY_STATS.NAPALM.symbol;
        delete ENTITY_STATS.NAPALM.symbol;

        try {
            render(
                <RadialMenu
                    x={100}
                    y={100}
                    onSelect={mockSelect}
                    onCancel={mockCancel}
                    playerEnergy={100}
                    hubFuel={10}
                />
            );

            // Go into OFFENSE category
            fireEvent.click(screen.getByText('OFFENSE'));

            // NAPALM has no symbol, so it should display its name (truncated if long)
            // item.type is "NAPALM", which is <= 10 characters so it won't be truncated.
            expect(screen.getByText('NAPALM')).toBeDefined();

            // Other items like WEAPON still have their display names
            expect(screen.getByText('WEAPON')).toBeDefined();
        } finally {
            // Restore original symbol
            ENTITY_STATS.NAPALM.symbol = originalNapalmSymbol;
        }
    });

    it('triggers onSelect when an item is clicked', () => {
        const mockSelect = vi.fn();
        const mockCancel = vi.fn();

        render(
            <RadialMenu
                x={100}
                y={100}
                onSelect={mockSelect}
                onCancel={mockCancel}
                playerEnergy={100}
                hubFuel={10}
            />
        );

        // Click UTILITY category
        fireEvent.click(screen.getByText('UTILITY'));

        // Click EXTRACTOR display name ('EXTRACT')
        fireEvent.click(screen.getByText('EXTRACT'));

        // Expect onSelect to be called with 'EXTRACTOR'
        expect(mockSelect).toHaveBeenCalledWith('EXTRACTOR');
    });
});
