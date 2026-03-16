# Defenses

## Defenses types

### Laser Point Defense - IMPLEMENTED [x]
#### Overview
A simple defense that can intercept anything, but can only fire once per turn before needing to recharge.
Fires an instantaneous laser that intercepts any single projectile within range.
The laser beam starts at the laser defense and ends at the intercepted projectile.
#### Stats
* **Range**: 100
* **Health**: 2
* **Launch Cost**: 25
* **Fuel**: 1
* **Damage**: 1
* **Interception chance**: 100%

### Light SAM Defense - IMPLEMENTED [x]
#### Overview
A missile based defense system that fires a light missile at any enemy projectiles within range.
#### Stats
* **Range**: 200
* **Health**: 2
* **Launch Cost**: 25
* **Fuel**: 1
* **Damage**: 2
* **Interception chance**: Projectile based

### Flak Defense - IMPLEMENTED [x]
#### Overview
A persistent area-of-denial defense system that creates a "wall" of flak in a 90° arc. 
Triggers on the first enemy projectile within range, locking its firing angle for the remainder of the round. 
Deals constant damage to any projectiles (friend or foe) crossing the hazard zone.
#### Stats
* **Range**: 150px
* **Health**: 2
* **Launch Cost**: 25
* **Fuel**: 1 (Single activation per round)
* **Damage**: 1
* **Interception chance**: Guaranteed damage to all units in the 90° hazard arc.
