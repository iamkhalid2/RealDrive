// Car.ts - Handles car physics, controls, and rendering
import * as THREE from 'three';
import { InputManager } from '../utils/InputManager';

export class Car {
  private mesh: THREE.Group;
  private inputManager: InputManager;
  private position: THREE.Vector3;
  private direction: THREE.Vector3;
  private rotation: number = 0; // Rotation in radians
  private speed: number = 0;
  private maxSpeed: number = 0.5;
  private currentMaxSpeed: number = 0.5; // For temporary speed effects
  private acceleration: number = 0.01;
  private deceleration: number = 0.005;
  private turnSpeed: number = 0.03; // How fast the car can turn
  private distanceTraveled: number = 0;
  private initialPosition: THREE.Vector3;
  private wheels: THREE.Mesh[] = [];
  private health: number = 100; // Add health property for damage handling
  private slowEffectEndTime: number = 0; // When the slow effect ends
  
  // Performance optimization
  private previousPosition: THREE.Vector3;
  private targetPosition: THREE.Vector3;
  private previousRotation: number = 0;
  private targetRotation: number = 0;

  constructor(scene: THREE.Scene, inputManager: InputManager) {
    this.inputManager = inputManager;
    this.mesh = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, 0);
    this.initialPosition = this.position.clone();
    this.direction = new THREE.Vector3(0, 0, 1); // Forward direction (Z+)
    
    // For interpolation
    this.previousPosition = this.position.clone();
    this.targetPosition = this.position.clone();
    
    this.createCarModel();
    scene.add(this.mesh);
  }

  private createCarModel(): void {
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
    const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    carBody.position.y = 0.5;
    this.mesh.add(carBody);
    
    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1.5, 0.7, 2);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xAA0000 });
    const carRoof = new THREE.Mesh(roofGeometry, roofMaterial);
    carRoof.position.set(0, 1.35, -0.5);
    this.mesh.add(carRoof);
    
    // Front lights
    const lightGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.1);
    const lightMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFF00,
      emissive: 0xFFFF00,
      emissiveIntensity: 0.5
    });
    
    const leftLight = new THREE.Mesh(lightGeometry, lightMaterial);
    leftLight.position.set(-0.7, 0.5, 2);
    this.mesh.add(leftLight);
    
    const rightLight = new THREE.Mesh(lightGeometry, lightMaterial);
    rightLight.position.set(0.7, 0.5, 2);
    this.mesh.add(rightLight);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const wheelPositions = [
      { x: -1.1, y: 0, z: 1.2, name: 'frontLeft' },
      { x: 1.1, y: 0, z: 1.2, name: 'frontRight' },
      { x: -1.1, y: 0, z: -1.2, name: 'rearLeft' },
      { x: 1.1, y: 0, z: -1.2, name: 'rearRight' }
    ];
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.name = pos.name;
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    });
    
    // Position car at origin
    this.mesh.position.copy(this.position);
    
    // Set up shadows
    this.mesh.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  // Update method now accepts delta time for fixed timestep
  public update(deltaTime: number = 1/60): void {
    // Store previous state for interpolation
    this.previousPosition.copy(this.position);
    this.previousRotation = this.rotation;
    
    // Check if slow effect has expired
    this.updateSpeedEffects();
    
    // Get input
    const forwardInput = this.inputManager.getForwardInput();
    const turnInput = this.inputManager.getTurnInput();
    
    // Scale acceleration by delta time for consistency
    const scaledAcceleration = this.acceleration * (deltaTime * 60); // normalized to 60fps
    const scaledDeceleration = this.deceleration * (deltaTime * 60);
    
    // Apply acceleration/deceleration based on input
    if (forwardInput > 0) {
      // Accelerate forward
      this.speed += scaledAcceleration;
    } else if (forwardInput < 0) {
      // Accelerate backward
      this.speed -= scaledAcceleration;
    } else {
      // Natural deceleration when no key is pressed
      if (this.speed > 0) {
        this.speed -= scaledDeceleration;
      } else if (this.speed < 0) {
        this.speed += scaledDeceleration;
      }
      
      // Prevent small floating-point speeds
      if (Math.abs(this.speed) < scaledDeceleration) {
        this.speed = 0;
      }
    }
    
    // Clamp speed to current maximum (which may be affected by slow effects)
    this.speed = Math.max(-this.currentMaxSpeed / 2, Math.min(this.currentMaxSpeed, this.speed));
    
    // Scale turn speed by delta time
    const scaledTurnSpeed = this.turnSpeed * (deltaTime * 60);
    
    // Apply turning based on input and current speed
    if (Math.abs(this.speed) > 0.01) {
      // Only allow turning when the car is moving
      this.rotation += turnInput * scaledTurnSpeed * (this.speed > 0 ? 1 : -1);
      
      // Update direction vector based on rotation
      this.direction.x = Math.sin(this.rotation);
      this.direction.z = Math.cos(this.rotation);
      
      // Turn front wheels for visual effect
      this.wheels.forEach(wheel => {
        if (wheel.name.startsWith('front')) {
          wheel.rotation.y = turnInput * Math.PI / 8;
        }
      });
      
      // Animate wheel rotation - scale by delta time
      const wheelRotationSpeed = this.speed * 0.5 * (deltaTime * 60);
      this.wheels.forEach(wheel => {
        wheel.rotation.x += wheelRotationSpeed;
      });
    }
    
    // Move car based on speed and direction - scale by delta time
    this.position.x += this.direction.x * this.speed;
    this.position.z += this.direction.z * this.speed;
    
    // Store target state for interpolation
    this.targetPosition.copy(this.position);
    this.targetRotation = this.rotation;
    
    // Update mesh position and rotation - will be interpolated in render
    this.updateVisualPosition(1.0); // Full interpolation on physics update
    
    // Update distance traveled for score
    if (this.speed > 0) {
      this.distanceTraveled += this.speed;
    }
  }
  
  // New method to interpolate visual position - called from render loop
  public interpolatePosition(alpha: number): void {
    this.updateVisualPosition(alpha);
  }
  
  // Update the visual position of the car mesh with interpolation
  private updateVisualPosition(alpha: number): void {
    // Interpolate position
    this.mesh.position.lerpVectors(this.previousPosition, this.targetPosition, alpha);
    
    // Interpolate rotation - handle potential angle wrapping
    let rotDiff = this.targetRotation - this.previousRotation;
    
    // Handle angle wrapping (keep rotation differences in -PI to PI range)
    if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    
    this.mesh.rotation.y = this.previousRotation + rotDiff * alpha;
  }
  
  // Update any active speed effects
  private updateSpeedEffects(): void {
    const now = Date.now();
    
    // Check if slow effect has expired
    if (this.slowEffectEndTime > 0 && now >= this.slowEffectEndTime) {
      // Reset to normal max speed
      this.currentMaxSpeed = this.maxSpeed;
      this.slowEffectEndTime = 0;
      
      // Clear any visual effects on the car
      this.mesh.traverse(object => {
        if (object instanceof THREE.Mesh && 
            object.material instanceof THREE.MeshStandardMaterial) {
          object.material.emissive = new THREE.Color(0x000000);
        }
      });
    }
  }
  
  // Method to apply a slow effect to the car
  public applySlowEffect(speedFactor: number, duration: number = 1000): void {
    // Apply speed reduction factor (0.7 means 70% of normal speed)
    this.currentMaxSpeed = this.maxSpeed * speedFactor;
    
    // Set when the effect will end
    this.slowEffectEndTime = Date.now() + duration;
    
    // Add a visual effect to show the car is slowed
    this.mesh.traverse(object => {
      if (object instanceof THREE.Mesh && 
          object.material instanceof THREE.MeshStandardMaterial) {
        // Add a slight red glow to indicate the car is slowed
        object.material.emissive = new THREE.Color(0x330000);
        object.material.emissiveIntensity = 0.3;
      }
    });
  }
  
  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }
  
  public setPosition(newPosition: THREE.Vector3): void {
    this.position.copy(newPosition);
    this.previousPosition.copy(newPosition);
    this.targetPosition.copy(newPosition);
    this.mesh.position.copy(this.position);
    
    // Update initial position for reset
    this.initialPosition.copy(newPosition);
  }
  
  public setTerrainHeight(height: number): void {
    // Adjust the car's Y position based on terrain height
    // Adding a small offset to keep the car above the ground
    this.position.y = height + 0.5;
    this.previousPosition.y = this.position.y;
    this.targetPosition.y = this.position.y;
    this.mesh.position.y = this.position.y;
  }
  
  public getDirection(): THREE.Vector3 {
    return this.direction.clone();
  }
  
  public getDistanceTraveled(): number {
    return this.distanceTraveled;
  }
  
  public stop(): void {
    this.speed = 0;
  }
  
  // Add takeDamage method to handle damage from hazards
  public takeDamage(amount: number, sourcePosition: THREE.Vector3): void {
    this.health -= amount;
    
    // Apply a knockback effect based on the source position
    const knockbackDirection = new THREE.Vector3()
      .subVectors(this.position, sourcePosition)
      .normalize();
    
    // Add some upward component to make it more dramatic
    knockbackDirection.y = 0.5;
    
    // Apply an impulse to the car's speed in the knockback direction
    this.speed -= 0.2; // Slow down the car when hit
    
    if (this.health <= 0) {
      // Car is destroyed
      this.health = 0;
      this.stop();
    }
  }

  // Add getter for health
  public getHealth(): number {
    return this.health;
  }
  
  // Update the reset method to also reset health
  public reset(): void {
    this.position.copy(this.initialPosition);
    this.previousPosition.copy(this.initialPosition);
    this.targetPosition.copy(this.initialPosition);
    this.direction.set(0, 0, 1);
    this.rotation = 0;
    this.previousRotation = 0;
    this.targetRotation = 0;
    this.speed = 0;
    this.currentMaxSpeed = this.maxSpeed; // Reset to normal speed
    this.slowEffectEndTime = 0;
    this.distanceTraveled = 0;
    this.health = 100; // Reset health
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    
    // Reset any visual effects
    this.mesh.traverse(object => {
      if (object instanceof THREE.Mesh && 
          object.material instanceof THREE.MeshStandardMaterial) {
        object.material.emissive = new THREE.Color(0x000000);
        
        // Reset emissive for headlights - special case
        if (object.position.z > 1.5 && object.position.y < 1) {
          object.material.emissive = new THREE.Color(0xFFFF00);
          object.material.emissiveIntensity = 0.5;
        }
      }
    });
  }
  
  public getCollider(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.mesh);
  }
}