# Weapons

## Weapons types

### Dumb bomb - IMPLEMENTED [x]
#### Overview
A simple weapon that travels in a straight line and explodes at it's landing spot.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 15
* **Damage**: 2
* **Type**: projectile
* **Damage type**: explosive
    * **Full Damage radius**: 10
    * **Half Damage radius**: 20
* **Speed**: NORMAL (5 px/tick)

### Super bomb - Temp for testing only. Remove Later. Implemented [x]
#### Overview
A simple weapon that travels in a straight line and explodes at it's landing spot.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 10
* **Damage**: 20
* **Type**: projectile
* **Damage type**: explosive
    * **Full Damage radius**: 10
    * **Half Damage radius**: 20
* **Speed**: VERY FAST (7 px/tick)

### Homing Missile - Implemented [x]
#### Overview
A homing weapon that launches and then starts travelling through the air to the nearest detected enemy structure. Target can not be reaquired if the target is destroyed before the projectile hits.
#### Stats
* **Range**: standard
* **Health**: 2
* **Launch Cost**: 20
* **Damage**: 2
* **Type**: homing missile
* **Damage type**: explosive
    * **Full Damage radius**: 10
    * **Half Damage radius**: 20
* **Speed**: SLOW (4 px/tick)
* **Homing speed**: VERY FAST (7 px/tick)
* **Homing range**: 300

### Cluster bomb - IMPLEMENTED [x]
#### Overview
A weapon that travels in a straight line but seperates before splitting into multiple small bombs that land in a line perpendicular to the direction of travel.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 30
* **Damage**: 1
* **Type**: projectile
* **Damage type**: explosive
    * **Full Damage radius**: 30
    * **Half Damage radius**: 30
* **Speed**: NORMAL (5 px/tick)

## Speed Tiers
| Keyword | Velocity | Arrival @ Max Range |
| :--- | :--- | :--- |
| **SLOW** | 4 px/tick | Tick 200 |
| **NORMAL** | 5 px/tick | Tick 160 |
| **FAST** | 6 px/tick | Tick 133 |
| **VERY_FAST** | 7 px/tick | Tick 114 |
| **TELE_STRIKE** | 20 px/tick | Tick 40 |

### Napalm - PLANNED [ ]
#### Overview
A specialized area-denial weapon. It launches as an interceptable canister that, upon arrival, releases a non-interceptable wave of fire in a straight line (stadium shape) extending forwards from the release point toward the source.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 35
* **Damage**: 1 per round (lingering)
* **Duration**: 2 rounds
* **Type**: projectile -> lingering hazard
* **Dimensions**: 150px length, 30px width (Capsule shape)
* **Speed**: NORMAL (5 px/tick)
