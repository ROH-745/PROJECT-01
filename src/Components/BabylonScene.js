import React, { useRef, useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders'; // Ensure loaders are included for external assets
import { openDatabase, addScene, getScene, clearDatabase } from './database';

const BabylonViewer = () => {
  const canvasRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [engine, setEngine] = useState(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]); // State for storing bounding boxes
  const [hitMesh, setHitMesh] = useState(null); // State for storing the current hit octree
  const [meshCount, setMeshCount] = useState(0); // State for storing the mesh count
  const [meshesInsideBoundingBox, setMeshesInsideBoundingBox] = useState([]); // State for storing meshes inside the bounding box
  const [meshesOutsideBoundingBox, setMeshesOutsideBoundingBox] = useState([]); // State for storing meshes outside the bounding box
  const [fps, setFps] = useState(0); // State for storing FPS

  useEffect(() => {
    // Clear the database on refresh
    clearDatabase();

    // Open the IndexedDB and initialize Babylon.js engine and scene
    openDatabase().then(() => {
      const engine = new BABYLON.Engine(canvasRef.current, true);
      const scene = new BABYLON.Scene(engine);

      // Set up the camera
      // const camera = new BABYLON.ArcRotateCamera("camera", 0, 0, 10, new BABYLON.Vector3(0, 0, 0), scene);
      // camera.setPosition(new BABYLON.Vector3(0, 0, -10));
      // camera.attachControl(canvasRef.current, true);

const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 1, -10), scene);
camera.setTarget(BABYLON.Vector3.Zero());
camera.attachControl(canvasRef, true);

      const raycamera = new BABYLON.FreeCamera("freecamera", new BABYLON.Vector3(0, 5, -10), scene);
      raycamera.setTarget(BABYLON.Vector3.Zero());
      raycamera.attachControl(canvasRef, true);

      scene.activeCamera = camera;

      // Set up the light
      new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

      let lastHitMesh = null;

      // Start the render loop
      engine.runRenderLoop(() => {
        scene.render();
        setFps(engine.getFps().toFixed(2)); // Update FPS state

        if (scene.activeCamera) {
          const ray = new BABYLON.Ray(scene.activeCamera.position, scene.activeCamera.getForwardRay().direction);
          const hit = scene.pickWithRay(ray);

          if (hit.pickedMesh) {
            const hitMesh = hit.pickedMesh;
            if (hitMesh !== lastHitMesh) {
              const hitMaterial = new BABYLON.StandardMaterial('hitMaterial', scene);
              hitMaterial.wireframe = true;
              hitMaterial.emissiveColor = new BABYLON.Color3(1, 0, 0);
              hitMesh.material = hitMaterial;

              // Log details of the hit mesh
              // console.log("Hit mesh Details");
              // console.log("name", hitMesh.name);
              // console.log("position", hitMesh.position);
              // console.log("Bounding Box", hitMesh.getBoundingInfo().boundingBox);

              // Update state with the new hit mesh
              setHitMesh(hitMesh);
              lastHitMesh = hitMesh;

              // Check which meshes are inside the hit mesh
              const meshesInside = [];
              const meshesOutside = [];
              scene.meshes.forEach(mesh => {
                if (mesh !== hitMesh) {
                  const boundingInfo = mesh.getBoundingInfo();
                  const boundingBox = boundingInfo.boundingBox;
                  if (
                    boundingBox.minimumWorld.x >= hitMesh.getBoundingInfo().boundingBox.minimumWorld.x &&
                    boundingBox.maximumWorld.x <= hitMesh.getBoundingInfo().boundingBox.maximumWorld.x &&
                    boundingBox.minimumWorld.y >= hitMesh.getBoundingInfo().boundingBox.minimumWorld.y &&
                    boundingBox.maximumWorld.y <= hitMesh.getBoundingInfo().boundingBox.maximumWorld.y &&
                    boundingBox.minimumWorld.z >= hitMesh.getBoundingInfo().boundingBox.minimumWorld.z &&
                    boundingBox.maximumWorld.z <= hitMesh.getBoundingInfo().boundingBox.maximumWorld.z
                  ) {
                    meshesInside.push(mesh);
                  } else {
                    meshesOutside.push(mesh);
                  }
                }
              });

              // console.log("Meshes inside the hit mesh:", meshesInside.map(mesh => mesh.name));
              // console.log("Meshes outside the hit mesh:", meshesOutside.map(mesh => mesh.name));

              // Update state with meshes inside and outside hit mesh
              setMeshesInsideBoundingBox(meshesInside);
              setMeshesOutsideBoundingBox(meshesOutside);
            }
          } else {
            // console.log("No mesh was hit by the ray");
          }
        }
      });

      // Handle window resize
      window.addEventListener('resize', () => {
        engine.resize();
      });

      // Set state
      setScene(scene);
      setEngine(engine);

      // Clean up on unmount
      return () => {
        window.removeEventListener('resize', () => {
          engine.resize();
        });
        scene.dispose();
        engine.dispose();
      };
    });
  }, []);

  const handleFileChange = (event) => {
    const files = event.target.files;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        const data = reader.result;
        const sceneData = { name: file.name, data: data };

        // Store scene data in IndexedDB and wait for completion
        const sceneId = await addScene(sceneData);
        console.log(`Scene added with ID: ${sceneId}`);

        // Load the scene from DB after storing
        const sceneDataFromDB = await getScene(sceneId);
        if (sceneDataFromDB) {
          BABYLON.SceneLoader.Append('', sceneDataFromDB.data, scene, (loadedScene) => {
            let minVector = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            let maxVector = new BABYLON.Vector3(-Number.MIN_VALUE, -Number.MIN_VALUE, -Number.MIN_VALUE);
            let meshesInside = [];

            // Calculate bounding box for each mesh and update cumulative bounding box
            loadedScene.meshes.forEach(mesh => {
              const boundingInfo = mesh.getBoundingInfo();
              const boundingBox = boundingInfo.boundingBox;
              // console.log(`Bounding Box for mesh ${mesh.name}:`, boundingBox);

              minVector = BABYLON.Vector3.Minimize(minVector, boundingBox.minimumWorld);
              maxVector = BABYLON.Vector3.Maximize(maxVector, boundingBox.maximumWorld);

              // Check if the mesh is inside the cumulative bounding box
              if (boundingBox.minimumWorld.x >= minVector.x && boundingBox.maximumWorld.x <= maxVector.x &&
                  boundingBox.minimumWorld.y >= minVector.y && boundingBox.maximumWorld.y <= maxVector.y &&
                  boundingBox.minimumWorld.z >= minVector.z && boundingBox.maximumWorld.z <= maxVector.z) {
                meshesInside.push(mesh);
              }
            });

            const cumulativeBoundingBox = new BABYLON.BoundingBox(minVector, maxVector);
            // console.log('Cumulative Bounding Box:', cumulativeBoundingBox);

            // Store the cumulative bounding box and meshes inside in state
            setBoundingBoxes(prevBoundingBoxes => [...prevBoundingBoxes, cumulativeBoundingBox]);
            setMeshesInsideBoundingBox(meshesInside);

            // Set the mesh count
            setMeshCount(loadedScene.meshes.length);

            // Create a cube based on the cumulative bounding box and divide it
            const divideCube = (minVector, maxVector, depth) => {
              if (depth > 2) return; // Limit the depth of division

              const boundingBoxSize = maxVector.subtract(minVector);
              const midVector = minVector.add(boundingBoxSize.scale(0.5));

              const divisions = [
                [minVector, midVector],
                [new BABYLON.Vector3(midVector.x, minVector.y, minVector.z), new BABYLON.Vector3(maxVector.x, midVector.y, midVector.z)],
                [new BABYLON.Vector3(minVector.x, midVector.y, minVector.z), new BABYLON.Vector3(midVector.x, maxVector.y, midVector.z)],
                [new BABYLON.Vector3(minVector.x, minVector.y, midVector.z), new BABYLON.Vector3(midVector.x, midVector.y, maxVector.z)],
                [midVector, maxVector],
                [new BABYLON.Vector3(midVector.x, midVector.y, minVector.z), new BABYLON.Vector3(maxVector.x, maxVector.y, midVector.z)],
                [new BABYLON.Vector3(midVector.x, minVector.y, midVector.z), new BABYLON.Vector3(maxVector.x, midVector.y, maxVector.z)],
                [new BABYLON.Vector3(minVector.x, midVector.y, midVector.z), new BABYLON.Vector3(midVector.x, maxVector.y, maxVector.z)],
              ];

              divisions.forEach(([min, max]) => {
                const size = max.subtract(min);
                const center = min.add(size.scale(0.5));

                const box = BABYLON.MeshBuilder.CreateBox("boundingBox", {
                  height: size.y,
                  width: size.x,
                  depth: size.z
                }, scene);

                box.position = center;
                box.isVisible = true; // Make sure the box is visible

                // Add material to the box for better visibility
                const boxMaterial = new BABYLON.StandardMaterial("boxMaterial", scene);
                boxMaterial.wireframe = true; // Show as wireframe
                boxMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0); // Green color
                box.material = boxMaterial;

                // Recursive call for further division
                divideCube(min, max, depth + 1);
              });
            };

            divideCube(minVector, maxVector, 1);

            // Adjust camera to focus on the loaded scene
            if (scene.activeCamera) {
              scene.activeCamera.attachControl(canvasRef.current, true);
            }
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="file"
        multiple
        accept=".babylon,.gltf,.glb"
        onChange={handleFileChange}
      />
      <canvas ref={canvasRef} style={{ width: '100%', height: 'calc(100vh - 40px)' }} />
      <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: '10px', borderRadius: '5px' }}>
        <h3>Meshes Count</h3>
        <p>Inside Hit Mesh: {meshesInsideBoundingBox.length}</p>
        <p>Outside Hit Mesh: {meshesOutsideBoundingBox.length}</p>
        <h3>FPS</h3>
        <p>{fps}</p>
      </div>
      <div>
        <h3>Cumulative Bounding Boxes</h3>
        <ul>
          {boundingBoxes.map((box, index) => (
            <li key={index}>
              Min: ({box.minimum.x.toFixed(2)}, {box.minimum.y.toFixed(2)}, {box.minimum.z.toFixed(2)}),
              Max: ({box.maximum.x.toFixed(2)}, {box.maximum.y.toFixed(2)}, {box.maximum.z.toFixed(2)})
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Hit Mesh Details</h3>
        {hitMesh ? (
          <div>
            <p>Name: {hitMesh.name}</p>
            <p>Position: ({hitMesh.position.x.toFixed(2)}, {hitMesh.position.y.toFixed(2)}, {hitMesh.position.z.toFixed(2)})</p>
            <p>Bounding Box: Min ({hitMesh.getBoundingInfo().boundingBox.minimum.x.toFixed(2)}, {hitMesh.getBoundingInfo().boundingBox.minimum.y.toFixed(2)}, {hitMesh.getBoundingInfo().boundingBox.minimum.z.toFixed(2)})</p>
            <p>Max ({hitMesh.getBoundingInfo().boundingBox.maximum.x.toFixed(2)}, {hitMesh.getBoundingInfo().boundingBox.maximum.y.toFixed(2)}, {hitMesh.getBoundingInfo().boundingBox.maximum.z.toFixed(2)})</p>
          </div>
        ) : (
          <p>No mesh is currently hit by the ray.</p>
        )}
      </div>
      <div>
        <h3>Mesh Count</h3>
        <p>{meshCount}</p>
      </div>
    </div>
  );
};

export default BabylonViewer;
