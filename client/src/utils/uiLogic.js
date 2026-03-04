export const shouldHighlightRing = (distance, radius, isAiming) => {
    return isAiming || distance < radius;
};
