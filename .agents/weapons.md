# Weapons

## Weapons types

### Dumb bomb - IMPLEMENTED [x]
#### Overview
A simple weapon that travels in a straight line and explodes at it's landing spot.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 10
* **Damage**: 2
* **Type**: projectile
* **Damage type**: explosive
    * **Full Damage radius**: 10
    * **Half Damage radius**: 20
* **Speed**: NORMAL (10 px/tick)

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
* **Speed**: VERY FAST (20 px/tick)

### Homing Missile - Implemented [x]
#### Overview
A homing weapon that launches and then starts travelling through the air to the nearest detected enemy structure. Target can not be reaquired if the target is destroyed before the projectile hits.
#### Stats
* **Range**: standard
* **Health**: 1
* **Launch Cost**: 20
* **Damage**: 2
* **Type**: homing missile
* **Damage type**: explosive
    * **Full Damage radius**: 10
    * **Half Damage radius**: 20
* **Speed**: SLOW (8 px/tick)
* **Homing speed**: FAST (16 px/tick)
* **Homing range**: standard

## Speed Tiers
| Keyword | Velocity | Arrival @ Max Range |
| :--- | :--- | :--- |
| **SLOW** | 8 px/tick | Tick 100 |
| **NORMAL** | 10 px/tick | Tick 80 |
| **FAST** | 16 px/tick | Tick 50 |
| **VERY FAST** | 20 px/tick | Tick 40 |
| **TELE-STRIKE** | 40 px/tick | Tick 20 |
