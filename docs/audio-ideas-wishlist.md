# Titan: Nexus Command Audio Wishlist & Roadmap

This document serves as the master catalog and strategic roadmap for all procedural chiptune and cybernetic sound effects within the *Titan: Nexus Command* audio system.

---

## Phase 1: Combat & Tactical Resolution
*Status: IMPLEMENTED & MERGED*

These sounds represent active simulation and resolution events played frame-accurately in the game board render loops.

- **Standard Launch/Shoot (`playShoot`)**: A short, high-pass pitch slide (standard projectiles, SAM defense).
- **Heavy Launch (`playHeavyLaunch`)**: A low-frequency thrust rumble (Homing Missiles, Nukes).
- **PD Laser Chirp (`playLaser`)**: A rapid, high-pitched clean chirp (Laser Point Defense).
- **Standard Weapon Impact (`playExplosion`)**: A retro white-noise crunch with rapid decay.
- **Shield Deflection / Spark (`playShieldHit`)**: A metallic, high-frequency chime ping (link collisions, shield damage, structural impacts).
- **Thermonuclear Boom (`playNukeDetonation`)**: A massive, deep low-frequency sweep with a long release and heavy noise modulation.
- **Link Severed (`playLinkSevered`)**: A snappy descending energy-pop sound when a network cable is cut.
- **Outpost Collapse (`playStructureDestroyed`)**: A digital, descending breakdown chime when a base hub or extractor is destroyed.

---

## Phase 2: Interactive Planning & UI feedback
*Status: DESIGNED (Implementing Now)*

These sounds cover real-time user interface selections, interactive strategic planning actions, and outpost orbital drop landing slams.

- **Terminal Button Click (`playClick`)**: A very short, high-pass digital blip for menu selections and action button clicks.
- **Seat Claim/Join Seat (`playSeatClaim`)**: A solid, mechanical digital lock-in tone when joining a multiplayer seat.
- **Telemetry Turn Uplink (`playUplink`)**: A rising high-fidelity electronic sweep when turn actions are committed/submitted.
- **Holographic Outpost Selection (`playTerminalSelect`)**: A rapid, sci-fi scanner chirp when selecting a hub/outpost.
- **Staging Cable Link (`playLinkStage`)**: A soft, cybernetic stretching ping when staging a link action.
- **Reset/Clear Staged Actions (`playActionReset`)**: A descending error buzz when actions are cleared/reset.
- **Structure Orbital Landing (`playStructureLanding`)**: A massive, bassy pneumatic impact when an outpost drops from orbit and stabilizes on Titan's surface.

---

## Phase 3: Future Strategic Concepts
*Status: POSTPONED (Future Roadmap)*

These concepts are designed for future strategic extensions as the game's simulation and sensory warning features expand.

- **Red-Alert: Base Under Attack**: A subtle, pulsing low-frequency warning klaxon that signals when base shields are breached.
- **Resource Depletion Alert**: A harsh, digital triple-beep when an Extractor runs out of raw minerals.
- **Stealth Cloaking hum**: A continuous, high-frequency phase-modulation drone that plays while a cloaked outpost remains undetected.
