import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { buildMachineScene, renderBallLabel } from '../utils/matterHelpers';

const FAST_MIX_DURATION_MS = 3000;
const SLOW_DOWN_BEFORE_OPEN_MS = 1000;
const GATE_OPEN_DELAY_MS = 550;
const BETWEEN_DRAWS_FAST_SPIN_MS = 1000;
const SLOW_SPIN_SETTLE_MS = 700;

function PingPongDrawMachine({
  options,
  drawCount,
  runSeed,
  resetToken,
  isDrawing,
  isPaused = false,
  onStatusChange,
  onResultsChange,
  onDrawComplete,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const machineRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const timeoutIdsRef = useRef([]);
  const drawTokenRef = useRef(0);
  const isRenderPausedRef = useRef(false);
  const [machineSize, setMachineSize] = useState({ width: 720, height: 640 });

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const updateSize = () => {
      const bounds = containerRef.current.getBoundingClientRect();
      setMachineSize({
        width: Math.max(320, Math.round(bounds.width)),
        height: Math.max(520, Math.round(bounds.height)),
      });
    };

    updateSize();
    resizeObserverRef.current = updateSize;
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserverRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !machineSize.width || !machineSize.height) {
      return undefined;
    }

    teardownMachine(machineRef, timeoutIdsRef);

    machineRef.current = buildMachineScene({
      Matter,
      canvas: canvasRef.current,
      width: machineSize.width,
      height: machineSize.height,
      options,
      onAfterRender: () => {
        renderBallLabel(machineRef.current);
      },
    });

    return () => {
      teardownMachine(machineRef, timeoutIdsRef);
    };
  }, [options, machineSize.width, machineSize.height, runSeed, resetToken]);

  useEffect(() => {
    if (!isDrawing || !machineRef.current || !options.length || drawCount < 1) {
      return undefined;
    }

    const drawToken = drawTokenRef.current + 1;
    drawTokenRef.current = drawToken;

    runDrawSequence(drawToken);

    return () => {
      drawTokenRef.current += 1;
      clearScheduledTimeouts(timeoutIdsRef);
    };
  }, [isDrawing, runSeed, drawCount, options]);

  useEffect(() => {
    const machine = machineRef.current;
    if (!machine) {
      return;
    }

    if (isPaused) {
      if (!isRenderPausedRef.current) {
        machine.Matter.Render.stop(machine.render);
        machine.Matter.Runner.stop(machine.runner);
        isRenderPausedRef.current = true;
      }
      return;
    }

    if (isRenderPausedRef.current) {
      machine.Matter.Render.run(machine.render);
      machine.Matter.Runner.run(machine.runner, machine.engine);
      isRenderPausedRef.current = false;
    }
  }, [isPaused]);

  const scheduleTimeout = (callback, delay) => {
    const id = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(id);
    return id;
  };

  const wait = (delay) =>
    new Promise((resolve) => {
      scheduleTimeout(resolve, delay);
    });

  const waitForBallToClaimExitLane = async (machine, drawToken) => {
    while (drawToken === drawTokenRef.current) {
      if (machine.state.currentCycleExitId) {
        return machine.state.currentCycleExitId;
      }

      await wait(40);
    }

    return null;
  };

  const waitForBallToClearGate = async (machine, drawToken, targetBallId) => {
    while (drawToken === drawTokenRef.current) {
      const ballBody = machine.state.ballMap.get(targetBallId);
      if (
        ballBody &&
        ballBody.position.y > machine.layout.openingY + machine.layout.ballRadius * 1.1
      ) {
        return true;
      }

      await wait(40);
    }

    return false;
  };

  const waitForSingleBallToReachRail = async (machine, drawToken, targetBallId) => {
    while (drawToken === drawTokenRef.current) {
      const newlyReached = machine.state.balls.filter(
        (ballBody) =>
          !machine.state.drawnIds.has(ballBody.labelId) &&
          ballBody.labelId === targetBallId &&
          hasReachedRail(machine.layout, ballBody),
      );

      if (newlyReached.length) {
        const ballBody = newlyReached[0];

        machine.state.drawnIds.add(ballBody.labelId);
        machine.state.currentCycleExitId = null;
        return ballBody.optionLabel;
      }

      await wait(70);
    }

    return null;
  };

  const runDrawSequence = async (drawToken) => {
    const machine = machineRef.current;

    if (!machine) {
      return;
    }

    onResultsChange([]);
    onStatusChange('Mixing balls...');

    machine.state.isMixing = true;
    machine.state.mixingIntensity = 1.15;
    machine.state.spinnerTargetSpeed = 0.095;
    machine.state.gateTargetProgress = 0;

    await wait(FAST_MIX_DURATION_MS);
    if (drawToken !== drawTokenRef.current) {
      return;
    }

    onStatusChange('Slowing spinner...');
    machine.state.mixingIntensity = 0.08;
    machine.state.spinnerTargetSpeed = (Math.PI * 2) / (60 * 20);
    await wait(SLOW_DOWN_BEFORE_OPEN_MS);
    if (drawToken !== drawTokenRef.current) {
      return;
    }

    const results = [];

    for (let index = 0; index < drawCount; index += 1) {
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      machine.state.currentCycleExitId = null;
      onStatusChange(`Opening gate for ball ${index + 1} of ${drawCount}...`);
      machine.state.gateTargetProgress = 1;
      await wait(GATE_OPEN_DELAY_MS);
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      onStatusChange(`Waiting for ball ${index + 1} of ${drawCount} to enter the gate...`);
      const exitBallId = await waitForBallToClaimExitLane(machine, drawToken);
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      if (!exitBallId) {
        return;
      }

      onStatusChange(`Waiting for ball ${index + 1} of ${drawCount} to clear the gate...`);
      const hasClearedGate = await waitForBallToClearGate(machine, drawToken, exitBallId);
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      if (!hasClearedGate) {
        return;
      }

      onStatusChange(`Closing gate for ball ${index + 1} of ${drawCount}...`);
      machine.state.gateTargetProgress = 0;
      await wait(220);
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      onStatusChange(`Waiting for ball ${index + 1} of ${drawCount} to reach the rail...`);
      const result = await waitForSingleBallToReachRail(machine, drawToken, exitBallId);
      if (drawToken !== drawTokenRef.current) {
        return;
      }

      if (!result) {
        return;
      }

      results.push(result);
      onResultsChange([...results]);

      if (index < drawCount - 1) {
        onStatusChange('Mixing balls...');
        machine.state.mixingIntensity = 1.05;
        machine.state.spinnerTargetSpeed = 0.095;
        await wait(BETWEEN_DRAWS_FAST_SPIN_MS);
        if (drawToken !== drawTokenRef.current) {
          return;
        }

        onStatusChange('Slowing spinner...');
        machine.state.mixingIntensity = 0.08;
        machine.state.spinnerTargetSpeed = (Math.PI * 2) / (60 * 20);
        await wait(SLOW_SPIN_SETTLE_MS);
        if (drawToken !== drawTokenRef.current) {
          return;
        }
      }
    }

    machine.state.isMixing = false;
    machine.state.spinnerTargetSpeed = 0.02;
    machine.state.mixingIntensity = 0;
    onStatusChange('Draw complete');
    onDrawComplete();
  };

  return (
    <section className="machine-panel">
      <div className="machine-stage" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}

function clearScheduledTimeouts(timeoutIdsRef) {
  timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
  timeoutIdsRef.current = [];
}

function teardownMachine(machineRef, timeoutIdsRef) {
  clearScheduledTimeouts(timeoutIdsRef);

  const machine = machineRef.current;
  if (!machine) {
    return;
  }

  const { Render, Runner, World, Events } = machine.Matter;
  Events.off(machine.engine, 'beforeUpdate', machine.beforeUpdateHandler);
  Events.off(machine.render, 'afterRender', machine.afterRenderHandler);
  Render.stop(machine.render);
  Runner.stop(machine.runner);
  World.clear(machine.engine.world, false);
  machine.Matter.Engine.clear(machine.engine);
  machine.render.canvas.width = 0;
  machine.render.canvas.height = 0;
  machine.render.textures = {};
  machineRef.current = null;
}

export default PingPongDrawMachine;

function hasReachedRail(layout, ballBody) {
  const minX = Math.min(layout.railLeftLipX, layout.railMainStartX) - layout.ballRadius * 0.6;
  const maxX = layout.railMainEndX + layout.ballRadius * 0.9;

  if (ballBody.position.x < minX || ballBody.position.x > maxX) {
    return false;
  }

  const clampedT =
    (ballBody.position.x - layout.railMainStartX) / (layout.railMainEndX - layout.railMainStartX);
  const t = Math.max(0, Math.min(1, clampedT));
  const railY =
    layout.railMainStartY + (layout.railMainEndY - layout.railMainStartY) * t - layout.ballRadius * 0.55;
  const nearRail = Math.abs(ballBody.position.y - railY) < layout.ballRadius * 1.35;
  const belowGate = ballBody.position.y > layout.openingY + layout.ballRadius * 2.2;

  return nearRail && belowGate;
}
