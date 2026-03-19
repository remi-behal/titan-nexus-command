# Structures

## Structure types

### Hubs
*   Hubs are the only structures that can create links by launching other structures.
*   Players start with a single "Starter Hub" which has more health and a unique appearance.
#### Stats
*   **Health**: 5
*   **Launch Cost**: 20 (Starter Hub is free)
*   **Fuel**: 3
*   **Vision**: 400
### Extractors
*   Extractors generate energy every turn and can be launched from Hubs.
#### Stats
*   **Health**: 2
*   **Vision**: 200
*   **Launch Cost**: 25
*   **Energy Gen**: 5 per turn

### Links
*   Links are created by launching structures from Hubs.
*   All links must eventually connect back to the Starter Hub. If a structure cannot be reached via a link from the Starter Hub, it is destroyed.
    *   This can create chain reactions where losing a single Hub destroys a large portion of a network.
    *   Links currently feature an arrow indicating the direction back to the source Hub.
    *   Links can not cross eachother. After a structure lands, a check is performed before the structure deploys to see if it touches any other links, if it does the structure is destroyed.
### Defenses
*   Defenses are launched from Hubs and protect against incoming projectiles via interceptions.
*   Some defenses may act passively in an offensive role against enemy structures (**TBD**).
*   See `defenses.md` for more details
