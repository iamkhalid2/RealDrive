import * as THREE from 'three';
import { Car } from '../../entities/Car';

export class HazardManager {
  private scene: THREE.Scene;
  private arenaSize: number;
  private hazards: THREE.Object3D[] = [];
  
  constructor(scene: THREE.Scene, arenaSize: number) {
    this.scene = scene;
    this.arenaSize = arenaSize;
  }
  
  public createHazards(): void {
    this.createLavaAreas();
    this.createSpikeTrap();
    this.createMovingHazards();
  }
  
  private createLavaAreas(): void {
    // Create lava pits or other damage-dealing areas with reduced intensity
    const lavaGeometry = new THREE.CircleGeometry(15, 32);
    const lavaMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.4  // Reduced from 0.7 to 0.4
    });
    
    // Add a few lava pits in the arena corners
    const positions = [
      new THREE.Vector3(this.arenaSize * 0.3, 0.1, this.arenaSize * 0.3),
      new THREE.Vector3(-this.arenaSize * 0.3, 0.1, this.arenaSize * 0.3),
      new THREE.Vector3(this.arenaSize * 0.3, 0.1, -this.arenaSize * 0.3),
      new THREE.Vector3(-this.arenaSize * 0.3, 0.1, -this.arenaSize * 0.3),
    ];
    
    positions.forEach(pos => {
      const lavaMesh = new THREE.Mesh(lavaGeometry, lavaMaterial);
      lavaMesh.rotation.x = -Math.PI / 2;
      lavaMesh.position.copy(pos);
      lavaMesh.userData = {
        isHazard: true, // Add this flag for collision detection
        type: 'hazard',
        hazardType: 'lava',
        damage: 5,  // Reduced from 10 to 5
        damageInterval: 800  // Increased from 500 to 800 milliseconds to slow down damage rate
      };
      
      this.scene.add(lavaMesh);
      this.hazards.push(lavaMesh);
    });
  }
  
  private createSpikeTrap(): void {
    // Create spike traps that extend and retract
    const baseGeometry = new THREE.BoxGeometry(10, 1, 10);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.7
    });
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, 0.5, 0);
    
    const spikeGeometry = new THREE.ConeGeometry(0.5, 2, 8);
    const spikeMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.7
    });
    
    // Create spikes on the base
    const spikes: THREE.Mesh[] = [];
    for (let x = -4; x <= 4; x += 2) {
      for (let z = -4; z <= 4; z += 2) {
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        spike.position.set(x, 1, z);
        spike.userData = {
          originalY: 1,
          extended: false
        };
        base.add(spike);
        spikes.push(spike);
      }
    }
    
    // Add spike trap data
    base.userData = {
      isHazard: true, // Add this flag for collision detection
      type: 'hazard',
      hazardType: 'spikes',
      damage: 15,
      damageInterval: 0, // immediate
      active: false,
      activationTime: 2000, // ms
      spikes: spikes,
      nextActivation: Date.now() + 5000
    };
    
    this.scene.add(base);
    this.hazards.push(base);
  }
  
  private createMovingHazards(): void {
    // Create moving hazards like crushers or swinging objects
    const crushGeometry = new THREE.BoxGeometry(10, 5, 10);
    const crushMaterial = new THREE.MeshStandardMaterial({
      color: 0x884400
    });
    
    const crusher = new THREE.Mesh(crushGeometry, crushMaterial);
    crusher.position.set(0, 10, -40);
    crusher.userData = {
      isHazard: true, // Add this flag for collision detection
      type: 'hazard',
      hazardType: 'crusher',
      damage: 50,
      damageInterval: 0, // immediate
      originalY: 10,
      direction: -1, // going down
      moveSpeed: 0.1,
      minY: 3,
      maxY: 15
    };
    
    this.scene.add(crusher);
    this.hazards.push(crusher);
  }
  
  public update(deltaTime: number): void {
    // Update hazard states
    this.hazards.forEach(hazard => {
      switch (hazard.userData.hazardType) {
        case 'spikes':
          this.updateSpikes(hazard);
          break;
        case 'crusher':
          this.updateCrusher(hazard, deltaTime);
          break;
        case 'lava':
          this.updateLavaEffect(hazard);
          break;
      }
    });
  }
  
  private updateLavaEffect(hazard: THREE.Object3D): void {
    // Fix: Cast to THREE.Mesh to properly access the material property
    // Removed unused deltaTime parameter
    if (hazard instanceof THREE.Mesh && hazard.material instanceof THREE.MeshBasicMaterial) {
      const pulseAmount = 0.1;
      const pulseSpeed = 1.5;
      
      // Create a subtle pulsing effect
      const baseOpacity = 0.4; // Match the opacity set in createLavaAreas
      hazard.material.opacity = baseOpacity + Math.sin(Date.now() * 0.001 * pulseSpeed) * pulseAmount;
    }
  }
  
  private updateSpikes(hazard: THREE.Object3D): void {
    const now = Date.now();
    
    // Check if it's time to activate
    if (now >= hazard.userData.nextActivation) {
      hazard.userData.active = !hazard.userData.active;
      
      // Move spikes
      hazard.userData.spikes.forEach((spike: THREE.Mesh) => {
        if (hazard.userData.active) {
          // Extend spikes
          spike.position.y = 2;
        } else {
          // Retract spikes
          spike.position.y = spike.userData.originalY;
        }
      });
      
      // Set next activation time
      hazard.userData.nextActivation = now + (hazard.userData.active ? 2000 : 3000);
    }
  }
  
  private updateCrusher(hazard: THREE.Object3D, deltaTime: number): void {
    // Move crusher up and down
    hazard.position.y += hazard.userData.direction * hazard.userData.moveSpeed * deltaTime;
    
    // Check if we need to reverse direction
    if (hazard.position.y <= hazard.userData.minY) {
      hazard.userData.direction = 1; // start going up
    } else if (hazard.position.y >= hazard.userData.maxY) {
      hazard.userData.direction = -1; // start going down
    }
  }
  
  public checkCollisions(carCollider: THREE.Box3, car: Car): boolean {
    let collided = false;
    
    this.hazards.forEach((hazard) => {
      if (hazard.userData && hazard.userData.isHazard) {
        const hazardBox = new THREE.Box3().setFromObject(hazard);
        
        if (carCollider.intersectsBox(hazardBox)) {
          collided = true;
          
          // Check for damage dealing (don't apply damage if no damage value set)
          if (hazard.userData.damage && hazard.userData.damage > 0) {
            // Update to call takeDamage with only the damage amount
            car.takeDamage(hazard.userData.damage);
          }
          
          // Apply slow effect if the hazard slows
          if (hazard.userData.slowFactor && hazard.userData.slowFactor < 1.0) {
            car.applySlowEffect(hazard.userData.slowFactor, hazard.userData.slowDuration || 1000);
          }
        }
      }
    });
    
    return collided;
  }
  
  public getEntitiesForMinimap(): any[] {
    const entities: any[] = [];
    
    // Add hazards to minimap
    this.hazards.forEach(hazard => {
      entities.push({
        position: hazard.position,
        type: 'hazard',
        hazardType: hazard.userData.hazardType
      });
    });
    
    return entities;
  }
  
  public reset(): void {
    // Reset all hazards to initial state
    this.hazards.forEach(hazard => {
      switch (hazard.userData.hazardType) {
        case 'spikes':
          hazard.userData.active = false;
          hazard.userData.nextActivation = Date.now() + 5000;
          hazard.userData.spikes.forEach((spike: THREE.Mesh) => {
            spike.position.y = spike.userData.originalY;
          });
          break;
        case 'crusher':
          hazard.position.y = hazard.userData.originalY;
          break;
      }
    });
  }
  
  // Add method to get hazard positions for spawn point management
  public getHazardPositions(): THREE.Vector3[] {
    const hazardPositions: THREE.Vector3[] = [];
    
    // Collect positions of all hazards
    this.hazards.forEach(hazard => {
      // For lava areas, which are the main concern for spawning
      if (hazard.userData.hazardType === 'lava') {
        hazardPositions.push(hazard.position.clone());
      }
    });
    
    return hazardPositions;
  }
}
