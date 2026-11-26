# Backing Down
## Game Design Document

Version 0.4 — playable prototype  
Status: vertical slice. Four heats, four trucks, one ramp.  
Last tuned: hitch no longer springs back to center while reversing.

This document is the source of truth for what the game is, why it feels the way it does, and which experiments were rejected. Numbers are the numbers in the build, not targets we hope to hit later.

---

## 1. One sentence

You race a truck backwards down a dirt fairground course with a boat on a trailer, then fight three rivals through one parking lot for the only ramp into the lake.

## 2. The fantasy

You are not a hero driver. You are the person at the boat ramp who thinks they can back a trailer better than everyone else in the lot. The whole race exists to deliver that last thirty seconds: four rigs, one concrete chute, a high corner camera, and the sick little moment when your hull actually goes in the water and theirs does not.

The dirt is the approach. The lot is the sport.

## 3. Player promise

- You are always reversing on purpose. Forward is a tool, not the race.
- The trailer is a real hinge. It bends at the ball. It does not drive itself back to straight while you are backing.
- There is one ramp. Second place is not a launch. Second place is "how close, and how broken."
- A season is short, mean, and disposable. You spend what you earn. When the season ends, the truck is stock again.
- It should look like a finished fairground from the first corner, not like a diagram that gets pretty at the finish.

## 4. Design pillars

1. **The hinge is the game.** If the boat does not swing off the hitch, there is no game. If it springs home by itself, there is no turn. If it jackknifes in half a second, there is no race.
2. **One ramp.** Scarcity is the joke and the rules. You can be ahead the entire dirt section and still lose the season in the lot.
3. **The camera tells you the mode.** On the dirt you drive. In the lot you watch a scramble. The cut between those cameras is the start of the real event.
4. **Upgrades are rented.** A better engine makes this season feel unfair. Next season you earn it again.
5. **Readable from above.** Trucks, boats, numbers, curbs, and the ramp must read at a glance. If a shape only works in a close-up, it does not exist.

## 5. What this is not

- Not a forward-driving arcade racer with a trailer cosmetic.
- Not a simulator with a gear lever, a spotter, and a checklist.
- Not a permanent-progression live service. There is no account, no database, no season pass.
- Not four ramps, a photo finish, or a shared launch. First hull in the water ends the argument.
- Not a game where the computer straightens your trailer for you while you hold reverse.

## 6. Reference and tone

Mechanical cousin: Ivan Stewart's Super Off Road. Top-down, chunky trucks, dirt, crowd, short races, spending between heats.

Subject: a Southern boat-ramp Saturday. Parish fair, catfish, a levee, a single public ramp. The copy talks like a person at the ramp, not like a menu. Names: Crawdad, June Bug, Ramp Rat. Paint names: Bone, Ember, Lake, Night. The banner over the water says ONE RAMP.

Tone is warm and a little mean. Nobody dies. Hulls get hurt. Somebody snakes the ramp.

Visual temperature: late-afternoon fair. Cream, ember orange, lake teal, packed dirt, asphalt gray, concrete, dark grass. Not neon. Not night. Not military.

## 7. The session

### 7.1 Loop

```
Title
  → Start season (or Continue)
    → Heat 1 dirt + lot
      → Results
        → Garage (spend points, optional)
          → Heat 2
            → ...
              → Heat 4
                → Champion
                  → Title, upgrades wiped, championship tally kept
```

A full season is four heats. A heat is one track. Tracks cycle in this order and then repeat if a season were ever longer:

1. Parish Fair
2. Catfish Cut
3. Levee Switch
4. The Only Ramp

### 7.2 Time

Each race clock starts at 82 seconds (`timeLeft` on a loaded race; attract mode uses 78). When the clock hits zero the race does not cut instantly. `outro` is set to 0.7 seconds, then results. If someone launches, `outro` is 2.15 seconds so the splash can be seen.

Pause exists only during a race.

### 7.3 Who is on track

Four rigs, always:

| Slot | Name | Role | Boat | Color | Skill | Nerve |
|---|---|---|---|---|---|---|
| 0 | You | Player | Chosen | Chosen paint | 1.00 | 1.00 |
| 1 | Crawdad | Rival | Bass | `#c44536` | 0.58 | 0.42 |
| 2 | June Bug | Rival | Ski | `#d7c4a1` | 0.46 | 0.28 |
| 3 | Ramp Rat | Rival | Jon | `#2f9e8f` | 0.82 | 0.74 |

Skill is how cleanly the AI looks ahead and how willing it is to commit to the ramp. Nerve is how hard it is willing to send the boat once it is close. Ramp Rat is the rival who will take the ramp from you. June Bug is the one who panics. Crawdad is the middle.

Spawn is staggered on the start straight so nobody occupies the same dirt:

- Lateral fractions of the half-width: -0.78, -0.26, 0.26, 0.78
- Distances down the centerline: 12 m, 16 m, 12 m, 16 m

You are slot 0.

## 8. How you win a heat

Places are assigned continuously during the race, then frozen into the results rows.

Sort:

1. A launched boat is always ahead of a boat still on land.
2. Otherwise, further along the centerline wins. Progress must differ by more than 0.35 m or it is treated as a tie on distance.
3. Otherwise, less hull damage wins.

Only one boat can be the launch. The launch sets `outro` and the race ends shortly after. Everyone else is scored on distance remaining and damage. There is no second splash.

### 8.1 The launch test

Evaluated for each rig that is not already launched and not at 100 damage, once progress is within 14 m of the end of the course.

The test looks at the midpoint between the hitch and the trailer axle, not the truck roof.

All of these must be true:

- The boat is past the end of the ramp centerline by more than 0.35 m (`along > 0.35`).
- It is centered in the chute: lateral error `< RAMP_HALF - boatHalfWidth + 0.08`.
- Trailer heading is within the boat's `angleTol` of the ramp heading.
- Reverse speed is committed but not a suicide run: slower than -2.1 m/s and faster than -13.5 m/s (speed is negative while backing).

Failing the chute while already past `along > 0.55` is a bounce:

- +8 damage times boat fragility
- Shoved back up the ramp by `along + 1.1` meters
- Speed flipped to +4.2 (a hard pop forward)
- 0.55 s before it can bounce again

A boat at 100 damage cannot launch. It can still place on distance.

### 8.2 Angle tolerance by boat

This is the "how straight" test. Wider, clumsier boats have to be straighter.

| Boat | angleTol (rad) | Degrees | halfWidth (m) |
|---|---|---|---|
| Jon | 0.48 | ~28° | 0.82 |
| Bass | 0.42 | ~24° | 0.76 |
| Ski | 0.36 | ~21° | 1.02 |
| Pontoon | 0.28 | ~16° | 1.32 |

The ramp chute is `RAMP_HALF * 2 = 5.44 m` wide. A pontoon (`halfWidth 1.32`) has very little lateral slop. A jon boat can be crooked and still splash. That is the trade.

### 8.3 Payout

```
base = [100, 62, 36, 18] for 1st through 4th
penalty = round(base * min(0.4, damage / 200))
bonus = 25 if you launched AND you are 1st, else 0
earned = max(0, base - penalty + bonus)
```

Damage of 80 on a win: penalty = round(100 * 0.4) = 40, plus the 25 launch bonus, so 85 points. A clean launch is 125. A crushed 4th is often under 18. Points are the only currency, and they are subtracted when you buy.

## 9. Season and garage

### 9.1 What persists

`localStorage` key `backing-down-save-v1`.

Kept forever:

- `championships` — how many seasons you won
- `best` — your highest single-season point total
- `muted`

Kept only for the current season, then wiped:

- engine level 0–2
- turn level 0–2
- owned boats and paints
- equipped boat and paint
- points for You, Crawdad, June Bug, Ramp Rat
- `round` and `racesRun`

Abandoning from the season menu nulls the season and returns to the title. Championships already earned stay.

There is no login. There is no cloud save. Private-mode browsers that throw on `localStorage` just play unsaved.

### 9.2 Championship

After heat 4, standings are sorted by points, then by name. You win the season if you are the sole leader, or if you are tied for the most points. A win increments `championships`. `best` updates if your points are higher. Then the season object is deleted.

Rivals earn the same payout formula. They do not spend, so their points only go up. You can out-earn them and then spend yourself out of the title. That is intentional. The garage is a trap if you buy everything before the last heat.

### 9.3 The garage, between heats

You spend Your points. Rivals do not have a garage.

| Upgrade | Levels | Cost to reach | Effect |
|---|---|---|---|
| Engine | 0 stock, 1, 2 | 60, then 150 | Reverse top speed 11.4 / 13.6 / 16. Reverse accel 20 / 26 / 33. Forward 9/10/11 and 18/20/22. |
| Tight turn | 0, 1, 2 | 60, then 150 | Truck yaw rate 1.9 / 2.3 / 2.75 rad/s. Forward straighten rate uses stability 0.7 / 1.35 / 2.15. |
| Boat | see table | one-time | Hull, mass, width, launch forgiveness, fragility. Buying equips it. Selecting an owned boat is free. |
| Paint | Bone free, others 40 | cosmetic | Truck color only. |

Boats:

| Boat | Price | Mass | Fragility | Blurb the player sees |
|---|---|---|---|---|
| Jon | 0 | 1.00 | 1.00 | Narrow aluminum. The honest way down the rails. |
| Bass | 110 | 0.84 | 1.42 | Light and quick. A hard bump folds the hull. |
| Ski | 140 | 1.12 | 0.70 | Thick glass. Shrugs off hay. Wider in the chute. |
| Pontoon | 100 | 1.26 | 0.52 | Barely dents. The ramp has to be dead straight. |

Mass divides acceleration. A bass boat gets up to speed sooner and gets destroyed by hay. A pontoon is slow and tough and will bounce off the chute unless it is painfully straight.

Paints: Bone `#e4d2b0`, Ember `#ef7b2a`, Lake `#1f8f86`, Night `#3d4540`.

Engine and turn do not carry a boat-specific multiplier beyond mass and fragility. There is no tire compound, no hitch upgrade, no sway-bar slot. If a hitch upgrade is ever added, it has to be rented for the season like everything else, and it cannot delete the hinge.

## 10. Controls

Throttle and steer are each clamped to [-1, 1]. They stack if two devices disagree, then clamp.

### 10.1 Keyboard

| Input | Action |
|---|---|
| S or Down | Reverse. This is the gas pedal of the race. |
| W or Up | Forward. Recovery. Pulls a folded trailer back toward straight. |
| A or Left | Steer +1. |
| D or Right | Steer -1. |
| Holding both W and S | They cancel. You coast. |
| P | Pause, race only. |
| M | Mute. Saved. |

Steer sign: +1 increases truck yaw while moving forward. While reversing, yaw rate is multiplied by -1, so the same key turns the nose the other way, which is what a steering wheel does. Do not "fix" this by flipping A and D. It has been flipped by mistake before and it makes the trailer feel broken.

Blur, tab-away, and visibility change clear the keyboard so a stuck key cannot drive the truck in the background.

### 10.2 Touch

A pad on the HUD sets `back`, `pull`, `left`, `right`. Those add into throttle and steer the same way as keys. The pad is the mobile interface. There is no virtual joystick that also steers the camera.

### 10.3 Gamepad

Read every frame from `navigator.getGamepads()`.

- Left stick X: steer, inverted so pushing right is steer -1 (matches D).
- Left stick Y: throttle, inverted so pushing up is forward.
- Deadzone 0.18, then rescaled so the edge is still full deflection.
- Right trigger (button 7) or value > 0.4: force reverse.
- Left trigger (button 6) or value > 0.4: force forward.
- D-pad left (14): steer +1. D-pad right (15): steer -1.

No rumble. No button icons in the HUD yet.

## 11. The truck and the trailer

### 11.1 Bodies

One rig is two headings.

- Truck pose: `x, z, yaw, speed, vx, vz`.
- Hitch: 1.9 m behind the truck origin, along the truck's backward axis. `HITCH = 1.9`.
- Tongue: 2.65 m from the hitch ball to the trailer axle. `TONGUE = 2.65`.
- Trailer heading: `trailerYaw`.
- Jack: `wrapAngle(truckYaw - trailerYaw)`, in radians. This is the bend at the ball. The HUD treats `abs(jack) > 0.85` as a jackknife warning.

Truck forward, at yaw 0, is world -Z. The mesh nose points -Z. The trailer mesh is built with the ball at local origin and the axle at +Z, so rotating the trailer group by `trailerYaw` puts the tongue on the hitch.

The boat is parented to the trailer, not the truck. If the boat does not bend when `trailerYaw` changes, the mesh is parented wrong. That bug has existed and it feels like "the boat barely moves" even when the math is fine.

### 11.2 What speed means

`speed` is signed along the truck nose.

- Positive: driving forward, the direction the grille points.
- Negative: backing. The race is almost entirely negative speed.
- Reverse tops out at -11.4 stock, -16 fully upgraded.
- Forward tops out at 9 stock, 11 fully upgraded. Forward is a wrench, not a gear you live in.

Acceleration is `throttle * accel * dt / mass`, then exponential drag.

- Coasting (throttle 0): drag 1.35
- On power: drag 0.42
- In a mud disc: +2.4
- Off the driving surface (`abs(lateral) > halfWidth - 0.2`): +1.5

Lateral velocity is bled toward the heading vector with a grip rate of 8.5, or 3.5 in mud. This is not a tire model. The truck does not drift on purpose. If it slides, something is wrong.

Truck yaw rate:

```
yaw += steer * turnRate * clamp(|speed| / 6.2, 0.45, 1) * sign * dt
sign = +1 if speed >= 0, else -1
```

You can still turn a little at low speed because of the 0.45 floor. That is how you set up a trailer before you are rolling.

### 11.3 The hitch, which is the whole game

Every step the tongue is a rigid rod.

1. Move the truck.
2. Put the hitch where the truck says it is.
3. Re-aim the tongue from the old axle to the new hitch and park the axle `TONGUE` meters back along that line.
4. That kinematic pose is the truth of the hinge for this step.
5. Then a policy decides how much of that truth the player is allowed to feel.

The policy is different in reverse and in forward. This is the part that kept getting ruined. Read it before changing it.

**While reversing (`speed < -0.05`): there is no spring toward center.**

The jack angle from the start of the step is remembered. The kinematic solve proposes a new jack. The change is clamped.

```
lot:     max |dJack/dt| = 0.22 + |steer| * 1.05   rad/s
newJack  = prevJack + clamp(kinJack - prevJack, -max*dt, +max*dt)
trailerYaw = truckYaw - newJack
```

**The dirt gets trailer assist. The lot does not.** Playtest feedback after the hold-an-angle build: the lot was right, the dirt was far too hard to race. The dirt now runs the same rate limit with three changes (constants `DIRT_*` in `sim.ts`):

```
dirt:    max |dJack/dt| = 0.12 + |steer| * 1.00   rad/s
         |jack| capped at 1.05 rad (~60°), under the 1.2 fold line
follow   = F * (1 - |steer|) * clamp(|speed| / 6, 0.4, 1.4)   1/s
         F = 1.3 for you, 1.7 for rivals (steadier hands)
ease     = jack * (1 - exp(-follow * dt))
jack    -= ease;  truckYaw -= ease        (trailerYaw does not move)
```

What this means with hands on the wheel:

- You steer, the truck rotates, the hitch walks, the boat bends. Full lock on the dirt adds about 1.1 rad/s of jack, up to 60°. The boat visibly swings off the ball through every dirt corner.
- Playtest note: a first pass (cap 0.95, follow 1.7) was manageable but the trailer barely looked like it pivoted. 1.05 / 1.3 keeps the bend on screen longer.
- You ease off the wheel and keep backing. **The truck swings in behind the boat. The boat keeps the heading you gave it.** That is what a good driver does with their hands, and the dirt does it for you. It is not the rejected spring: that spring pulled the trailer back toward the truck and erased the turn. This one moves the truck and leaves the turn in the boat.
- The bend cannot pass 1.05 rad on the dirt, so the hinge cannot fold the boat there. Walls and bales on the dirt also do half damage (`DIRT_WALL_DAMAGE`).
- In the lot none of this applies. A centered reverse still walks the angle out at 0.22 rad/s, full lock adds about 1.27 rad/s, and nothing swings the truck in for you. The lot is where a sloppy bend becomes a fold.
- Counter-steer moves the jack the other way. You steer the hinge. On the dirt the game straightens the truck behind it when you let go.

**While pulling forward (`speed > 0.2`): the trailer comes home.**

```
pull rate = max(1.6, stability) rad/s toward truck yaw
stability = 0.7 / 1.35 / 2.15 by turn upgrade
```

W is the reset. A folded trailer on the dirt is a choice to stop backing and pull. The turn upgrade makes that recovery faster. It does not glue the boat to the truck while you are racing backwards.

**Between -0.05 and +0.2:** the kinematic pose is left alone. You are basically stopped.

### 11.4 Why the hitch feels like this (rejected versions)

These were built, played, and thrown out. Do not put them back because a graph looks nicer.

| Version | What it did | Why it died |
|---|---|---|
| Pure kinematic + 0.7 rad/s center spring | Real hinge, always creeping back toward the truck, and also running away | Too squirrely to race. Also, the creep-to-center ate any angle you tried to hold. |
| Strong course damper, exponential pull toward truck yaw, rate ~7.8 | Boat followed the truck and straightened the moment you eased off | Too easy. The boat barely looked like a trailer. |
| Same idea, rate ~3.3, damage brought back | Still a spring toward center, just weaker | Still did not function like a trailer. Turns would not hold. |
| Rate-limit world yaw only | Truck could spin away from a frozen trailer, so the jack number grew even when the boat was nailed to the world | Measured like a swing. Drove like the trailer was stuck in the mud. |
| Hold-an-angle on the dirt, no assist (0.04 + 0.70 rad/s) | The bend stayed wherever you left it, on the dirt as well as the lot | Way too hard to race. A simple steer-the-boat test driver hit a wall and stalled on the first Parish bend at 47% hull. With dirt assist the same driver clears the dirt under 0.5 rad of bend. |

The current rule: **on the dirt, steering bends the boat and letting go lines the truck up behind it; in the lot, backing holds an angle, steering changes it, and only forward erases it.**

### 11.5 Folding and damage from the hinge

Jack is in radians. Damage is 0–100.

- `|jack| > 1.2` (~69°): damage ticks at `(amount over 1.2) * 26 * fragility` per second, and speed is bled with `exp(-2.2 * dt)`.
- `|jack| > 1.55` (~89°) and the jack cooldown is ready: a slam. +9 damage times fragility, speed multiplied by 0.4, cooldown 0.85 s. Counts as a hit and a jack event (camera shake, audio).

On the dirt the bend is capped at 1.05, so the hinge itself never damages the boat there. In the lot, holding full lock until the boat is sideways is how you buy a slam.

100 damage does not stop the truck. It stops the launch.

### 11.6 Wheels, visually

Wheel meshes spin on local X by `speed * dt * 1.5`. Truck wheels and trailer wheels share the list. They do not steer visually. The hinge is the read, not the front wheels.

## 12. The world

### 12.1 Shape of a course

A track definition is a polyline in meters, a base width, a list of mud fractions, and a bale count. The builder:

1. Resamples the polyline.
2. Extends it with a straight parking lot and a ramp. The lot is not drawn as a continuation of the dirt. It is a new room at the end of the dirt.
3. Builds walls from the half-width function.
4. Drops round hay bales just outside the dirt.
5. Drops mud discs at the given fractions of the distance to the lot mouth.

Lot constants, every track:

| Constant | Value | What it is |
|---|---|---|
| LOT_HALF | 26 m | Half the asphalt width. The lot is 52 m wide. |
| LOT_DEPTH | 46 m | Mouth to the top of the ramp. |
| RAMP_LEN | 16 m | Concrete into the water. |
| RAMP_HALF | 2.72 m | Half the chute. 5.44 m between the rails. |
| TAPER | 12 m | How quickly the lot squeezes down to the chute. |
| poleH | 16 m | The corner light the lot camera is pretending to hang from. |

Half-width along the course:

- On the dirt, the road half-width is the track's base width.
- Over the last 14 m before the lot, it flares from road width to 26 m.
- Through the lot it stays 26 m until 12 m before the ramp.
- Then it squeezes from 26 m to 2.72 m.
- On the ramp it stays 2.72 m.

Walls follow that width. The ramp has an extra 5 m of rail past the end so you cannot slide off the side into a fake splash.

### 12.2 The four tracks

Distances below are the authored polyline, before the lot is bolted on. The lot adds 46 + 16 m of centerline to every one of them.

**Parish Fair.** Width 16 m. No mud. 2 bales.  
"Wide dirt and a gentle S. Learn the trailer before the lake does."  
Polyline from `{0, 88}` through a soft S to `{0, -92}`. This is the tutorial heat even though the game never says tutorial. If a new player cannot finish Parish, the hitch is wrong, not the player.

**Catfish Cut.** Width 13.5 m. Mud at 38% and 55% of the way to the lot. 3 bales.  
"Mud in the bends. Straighten early or you'll arrive sideways."  
A left-then-right cut. The mud discs are 7.5 m radius. Mud adds drag and kills grip. You arrive at the lot slower and usually more crooked.

**Levee Switch.** Width 12.8 m. Mud at 48%. 4 bales.  
"The hairpins fold a trailer. Pull forward. Then commit."  
The narrow one. This is the heat where W is part of the racing line, not a confession. Bales sit closer because the road is tighter.

**The Only Ramp.** Width 15 m. Mud at 62%. 3 bales.  
"A long run, then the chute squeezes. Somebody will try to take it from you."  
The longest polyline, starting at `{0, 108}`. The dirt is the easy part of the name. The name is about the lot.

### 12.3 Dirt dressing

The dirt must use the same craft as the lot. A flat ribbon on a green circle was the prototype, and it is not allowed back.

From the bottom of the stack:

- Shoulder band, darker dirt `#8a6844`, from the road edge out 2.8 m, sitting at y = 0.06.
- Driving surface, `#d7b07a`, y = 0.11, tiled dirt texture.
- Concrete curb band, `#c5c1b6`, 0.5 m wide, y = 0.20, both sides.
- Cream edge lines inset from the curb.
- Cream center dashes, 0.34 × 3.1 m, every 9 m.
- Orange chevrons every 18 m, pointing downtrack, starting 20 m in.
- A checker start line at 9 m.
- A gantry banner at 5 m with the track name in cream on black, ember rules top and bottom.
- Light poles both sides every 30 m, 9.5 m masts, warm lamps, ember pennants.
- A four-step grandstand at 24 m on the right, 36 crowd boxes in ember, cream, teal, red, night, and tan.
- Hay bales as banded cylinders.
- Trees: trunk plus a low sphere crown, both sides, every 16 m, outside the curb.

Grass is the ground plane under all of it. Fog is `#9eb8c4`, near 95, far 220, so the higher dirt camera still sees color.

### 12.4 The lot

Entered when progress passes `lot.start`.

- Asphalt plane, 52 × 46 m, texture tinted `#b7bcc0`, y = 0.11.
- Cream stall ticks every 4.8 m, skipped across the ramp mouth.
- Concrete curbs on the long sides and across the water edge, broken only for the chute.
- Orange rails down both sides of the ramp.
- Concrete ramp slab, tilted 0.07 rad, grooved concrete texture.
- Sand, then a transparent water plane (`#8fd0d4`, opacity 0.94) past the ramp. Water texture scrolls.
- Four light poles. Three are 11 m. The camera-side pole is `poleH` (16 m) so the shot has a mast in it.
- A "ONE RAMP" banner.
- Three orange chevrons on the asphalt aiming at the chute.

Ground height for the trucks is 0.12 until the ramp, then it eases to 0.05 across `RAMP_LEN`. The boats visually drop when launched (see juice).

### 12.5 The lot camera, exactly

This shot is not a follow camera. The player asked for a locked camera at "about where a large light pole would be, then half that distance again."

- Pole stands at the far corner of the lot, 16 m up.
- Look target is 62% of the way from the mouth to the far edge, so the ramp and the scramble share the frame.
- Camera position is the pole, pushed further outside the lot by half the pole-to-center distance, and lifted to `poleH * 1.5 = 24` m.
- Field of view 58°.
- It eases in. It does not cut on the first frame you touch the asphalt, and it does not go back to the roof if you bobble on the mouth.

The point of the shot: you can see all four rigs, the rails, and the water at once. Whoever is straight owns the ramp. Whoever is folded is entertainment.

### 12.6 The dirt camera

Earlier the dirt camera sat too close and too dead-above the roof (about 22 m up, almost on the truck). That hid the course.

The 44 m roof camera in truck space was still too close and too overhead, and it spun with the truck every time the rig swung. Current dirt camera (`DIRT_CAM` in `render.ts`), in **course** space:

- Framed on the course direction 10 m ahead of the rig, smoothed, so it does not spin when the truck or boat swings.
- Centered on the middle of the rig (truck and trailer axle).
- Height 54 m, 30 m back up the course, 20 m off to one side.
- Look target 16 m down the course from the rig, 0.2 m off the ground. You see where you are going, which is past the boat.
- Field of view 50°.
- That gives an oblique, three-quarter view of the dirt, the same kind of shot as the lot corner camera, which is what makes the two halves read as one game.
- Follow ease is faster than the lot ease (`exp(-4 dt)` vs `exp(-2.4 dt)`).

If someone asks to drop this camera back onto the roof, the dirt will look like a prototype again. Do not do it for "intensity." Intensity is the lot.

## 13. Rival brains

Each AI rig gets throttle and steer from `ai()`, then the same integrator as the player. They do not cheat on collision, damage, or the launch test. They do not see the future. They see a point down the track.

### 13.1 On the dirt

Lookahead is `12 + skill * 6` meters, clamped so they are not aiming into the lot early. Desired heading is the heading from the **trailer axle** toward that point, plus a sine wander of `(1 - skill) * 0.28` radians so June Bug hunts and Ramp Rat does not.

On the dirt they steer the boat, the way the assist expects a player to: `steer = clamp(-boatHeadingError * 2.5, -1, 1)`, where the error is against `trailerYaw`.

Throttle wants to be `-0.86 - skill * 0.14` (backing, faster if skilled). Big heading error lifts the throttle toward zero, and so does the bend 6 to 24 m ahead, so they brake before a corner instead of in it. Low nerve brakes harder.

They pull forward (throttle +1) in three cases:

- `|jack| > 1.02` in the lot: they felt a fold. Desired heading becomes the trailer heading. (On the dirt a big bend is capped short of a fold, so it is a turn, not a reason to bail.)
- No progress for 1.1 s after the first 4 s: pinned on a wall, a bale, or a truck. On the dirt they swing the nose while pulling so the boat will back toward the course, not into the same wall.
- While still rolling forward from a pull they hold the wheel straight; reverse steering at positive speed turns the wrong way.
- The boat points more than 1.3 rad away from the course: spun around. They drive forward and swing the nose toward the course until the boat lines up again.

They also steer away from a rig that is ahead of them and within 7 m.

### 13.2 In the lot

Once progress is within 2 m of the lot, lookahead changes. They aim at a gate near the ramp, spread sideways by a seed so all three do not stack on the same stall:

```
lane = ((seed % 7) - 3) * 3.4
spread dies to 0 once they are inside 18 m of the end
```

Inside 28 m of the end they stop simply backing and start a commit check. If the trailer is aimed well enough for their skill, throttle goes to a commit between -0.35 and -0.9 based on nerve. If the aim is bad, they creep at -0.18. If the jack is past 0.75 they yank forward at +0.85. Inside 8 m, if the jack is under 0.45, they send it: throttle `-0.55 - nerve * 0.35`.

Ramp Rat (nerve 0.74, skill 0.82) commits. June Bug (nerve 0.28, skill 0.46) creeps and bails. That is the whole personality system. Do not add dialogue.

## 14. Contact

### 14.1 Walls and bales

Each rig is three circles: nose, tail, and trailer axle, radii about 0.78, 0.78, and 0.82. Walls are segments. Bales are circles. A hit pushes the rig out, including the axle, then the tongue is solved again.

If impact speed is over 3.2 and the hit cooldown is clear:

- damage += impact * 0.85 * fragility
- cooldown 0.22 s
- speed *= 0.9
- the hit event fires (shake)

Off-track is not a wall. It is drag. You can drop a wheel off the curb and pay for it in speed, then come back.

### 14.2 Trucks hitting trucks

After the wall pass, rigs separate as circles. If the closing speed (difference of the two velocity vectors, not the sum of both speedometers) is over 8 and both cooldowns are clear, both take `rel * 0.22 * fragility` damage, both slow to 92%, cooldown 0.2 s. The lot is where this matters. On the dirt you mostly hit hay.

## 15. Presentation

### 15.1 Truck read

From the dirt camera you must be able to tell, in one glance:

- Which way the grille points (lamps, hood, glass).
- Which way the boat points (it will not match).
- Who is who. A canvas plate on the roof says YOU or the rival's name. You are ember. Rivals are cream.
- Whether the hull is the jon, the bass, the ski, or the pontoon. They are not the same mesh with a color swap. The hull is a row of cross-sections. The pontoon reads wide. The bass reads narrow and dark green.

Trailer parts, all in the trailer group so they hinge: ball, tongue, frame rails, bunks, two wheels, shadow blob, boat.

### 15.2 Light

Hemisphere plus a sun. Shadows are off. They were on once and the frustum ate the track. Do not turn shadow maps back on to feel "modern" unless the far dirt and the lot camera are both tested.

Lamps on the poles are emissive warm white. They are set dressing, not gameplay lights. The race is readable at noon.

### 15.3 Juice

- Dust puffs at the truck when `|speed| > 2.6` and the boat is not launched.
- Splash event on a successful launch. Audio plus shake 0.4.
- Any hit adds shake, capped at 0.45.
- On launch, the boat mesh slides forward and down over 900 ms, off the bunks and toward the water. The truck stays. The trailer stays. The boat leaves.
- Water texture scrolls.
- No screen-space flash, no letterbox, no slow motion.

### 15.4 HUD during a race

The world is the game. The HUD is a strip.

- Heat name, clock, place, speed, feet left, hull percent.
- A jackknife warning when `|jack| > 0.85`.
- The other three rigs as a standings list: color, name, place.
- Touch pad.
- Pause and mute.

No minimap. The dirt camera is the minimap. The lot camera is the scoreboard.

### 15.5 Screens

**Title.** The name, the promise (one ramp, you are backing), championships and best if you have them, Start, Continue if a season exists, mute.

**Results.** Headline written from the truth of the heat:

- You launched and won: "You put it in the water."
- Someone else launched: "{Name} snaked the ramp." plus your place, feet short, and hull percent.
- Nobody launched and you were closest: "Nobody launched. You were closest."
- Otherwise: "{Name} was closer."

Rows show place, launched or not, feet remaining, damage, points earned.

**Garage.** The four buys. You can skip it. Points left are yours.

**Champion.** Won or lost, the four totals, the championship count. Start over is a new season at zero upgrades.

### 15.6 Audio

WebAudio, unlocked on the first gesture. Engine pitch follows speed. Hits, the jack slam, and the splash are noises, not music. Mute is a saved boolean that zeros the graph. There is no soundtrack. If music is added later it should be one fairground loop and it should duck under the splash, not the other way around.

### 15.7 Type and color

The UI uses the same inks as the world.

- Ink `#101412`
- Cream `#f4efe4`
- Ember `#ef7b2a`
- Lake `#1f8f86`

Display type is heavy and condensed for the clock, the place, and the track banner. Body type is the app font. Do not introduce a third accent.

## 16. Feel targets

These are the sentences a playtester should be able to say. If they say the opposite, the tuning is wrong.

On Parish Fair, backing, steer then let go:

> "The boat turned, the truck fell in behind it, and I made the corner."

On Parish Fair, holding the wheel:

> "It keeps swinging until I let go of the wheel."

On the first time they reach the asphalt:

> "Oh. The camera left me. Everyone is in this lot."

On a bad ramp attempt:

> "I bounced. They took it."

On the garage:

> "If I buy the pontoon I might not have enough to win the season."

Sentences that mean the build is wrong:

> "It straightens itself when I back up in the lot."
> "The boat is glued to the truck."
> "I can't make a dirt corner backwards."
> "I jackknife before I finish the first turn, every time."
> "I can't tell which way I'm backing."
> "The dirt looks like a diagram and the lot looks like a game."

## 17. Technical shape

Browser game. One page. No account.

- UI shell: TanStack Start, React 19, Tailwind 4. The game is a component (`BackingDown`) over a canvas.
- World: Three.js r187. One `WebGLRenderer`, one scene, rebuilt when the sim says `dirty` (new heat).
- Sim: fixed step 1/60, at most 8 steps per frame, leftover time kept in an accumulator. Render never runs the integrator.
- Input, audio, save, and the React snapshot are outside the integrator. The sim does not import React.
- Probe, dev only: `window.__backing` exposes phase, speed, progress, damage, jack, clock, place. `window.__controlsTest.setKeys` injects key codes. Do not ship a "jump to the lot" cheat on that probe.

File map for the game itself:

| File | Owns |
|---|---|
| `src/game/content.ts` | Boats, paints, prices, AI roster, track polylines, payout. |
| `src/game/track.ts` | Resample, lot extension, half-width, walls, bales, mud, lot camera frame. |
| `src/game/sim.ts` | Integrator, hitch policy, AI, collision, launch, ranking. |
| `src/game/vehicles.ts` | Truck, trailer, boat meshes. The hinge origin. |
| `src/game/render.ts` | Course art, lot art, cameras, dust, launch animation. |
| `src/game/textures.ts` | Canvas textures: dirt, asphalt, concrete, water, sand. |
| `src/game/input.ts` | Keys, touch flags, gamepad. |
| `src/game/audio.ts` | Engine, hit, splash, mute. |
| `src/game/save.ts` | localStorage schema v1. |
| `src/game/Game.ts` | Phase machine, garage transactions, snapshot for React. |
| `src/components/BackingDown.tsx` | Every screen and the HUD. |

The app shell around that (router, auth stubs, PWA, OG images) is the host. The game does not call it.

### 17.1 Performance budget

The dirt dressing is a lot of meshes: poles, dashes, crowd, trees. That is acceptable. Shadow maps are not. If frame time dies, instance the poles and the dashes before you delete the grandstand. The grandstand is how the dirt says "this is the same game as the lot."

### 17.2 Build

`npm run dev` serves the game. `npm run build` must pass before a change is called done. `@tanstack/react-start` must stay at 1.168.60 or newer. Older versions are rejected on deploy.

## 18. Content budget for a new heat

A new track is a polyline, a width, mud fractions, a bale count, a name, and a one-sentence blurb. The lot, the ramp, the camera, the launch test, and the art language are automatic. Do not author a second ramp. Do not author a track with no straight long enough to see the trailer before the first bend. Parish's opening is the minimum: you get a moment to feel the hinge before the dirt asks a question.

A new boat needs a price, a mass, a fragility, a half-width, an angle tolerance, a color, a blurb, and a hull that reads at 44 m. If it does not change a decision in the garage, it is a skin.

A new rival needs a name, a color, a boat, a skill, and a nerve. Four rigs is the frame. A fifth truck breaks the lot camera and the payout table. Do not add one.

## 19. Open questions

These are not licensed to be changed in a drive-by.

1. **Is the dirt assist the right strength?** The knobs are the `DIRT_*` constants in `sim.ts`. If the dirt is now too easy, lower `DIRT_FOLLOW` first, then raise the cap. Do not touch the lot to fix the dirt.
2. **Should a crooked trailer push the truck?** Right now the truck goes where its heading says, and the trailer follows on a rod. A real tongue shoves the tow vehicle when the angle is large. Adding that force will change every corner. If it is added, it is a shove at high jack only, and it is tested on Parish before it is tested in the lot.
3. **Does the season want a fifth heat that is only the lot?** Not yet. The dirt is the wind-up. A lot-only heat is a different game.
4. **Local two-player?** The input path can take two action structs. The camera cannot. The lot camera is shared, which is almost a party view, but the dirt camera is per truck. Split dirt cameras are a feature, not a weekend.
5. **Hitch as a garage item?** Only as a rented change to the jack rate cap, never as a switch that turns the spring back on.

## 20. Glossary

- **Backing.** Reverse. Negative `speed`. The sport.
- **Jack.** The signed angle at the ball between truck heading and trailer heading.
- **Fold / jackknife.** `|jack|` past about 1.2 rad, where the hull starts paying for it.
- **Commit.** Reverse speed in the launch window, trailer aimed, boat in the chute.
- **Snake.** Launch while someone else was ahead on the dirt. The headline is "snaked the ramp."
- **Hold an angle.** Center the wheel, keep backing, the bend stays. This is legal and required.
- **Pull.** W. Forward. The only self-straighten in the game.
- **The lot.** The 52 × 46 m asphalt room. One ramp. Locked camera.
- **Season.** Four heats. Upgrades die at the end.

## 21. The finish line for this prototype

The prototype is done enough to race when all of these are true in one sitting:

1. Parish can be backed through without a jackknife on the first bend, and the lot still holds whatever bend you leave in it.
2. The dirt camera shows curbs, poles, the grandstand, and the boat, not the roof.
3. Crossing into the asphalt locks the high corner camera and it stays there.
4. Two trucks can arrive crooked, and only a straight, committed boat splashes.
5. A bounced boat is shoved back up the ramp and somebody else can still take it.
6. Points buy a real change, and the next season starts on a stock jon with Bone paint.
7. Refreshing the page remembers championships and a season in progress, and remembers nothing else.
