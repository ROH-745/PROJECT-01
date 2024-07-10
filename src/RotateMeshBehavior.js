import React, { useEffect } from "react";
import * as BABYLON from "@babylonjs/core";

const RotateMeshBehavior = ({ mesh, radians, axis }) => {
  useEffect(() => {
    if (!mesh) return;

    const rotateMesh = () => {
      mesh.rotate(axis, radians, BABYLON.Space.LOCAL);
    };

    const scene = mesh.getScene();
    const renderLoop = scene.onBeforeRenderObservable.add(rotateMesh);

    return () => {
      scene.onBeforeRenderObservable.remove(renderLoop);
    };
  }, [mesh, radians, axis]);

  return null;
};

export default RotateMeshBehavior;
