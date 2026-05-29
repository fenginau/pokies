import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import { DEFAULT_FELLOW_AVATAR_SRC } from '../constants/assets'

const MAX_LANES = 3
const HEADER_HEIGHT = 108
const LANE_GAP = 22
const MAX_PULL_DISTANCE = 150
const BALL_RESTITUTION = 0.08
const BALL_FRICTION_AIR = 0.022
const PIN_RESTITUTION = 0.04
const PIN_FRICTION_AIR = 0.08
const PIN_KNOCK_DISTANCE = 18
const PIN_KNOCK_ANGLE = 0.32
const LANE_INSET = 12
const BALL_MAX_TRAVEL_MARGIN = 1.06

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function buildLaneLayouts(width, height, laneCount) {
    const playableHeight = Math.max(320, height - HEADER_HEIGHT - 32)
    const laneHeight = Math.max(
        130,
        Math.min(210, (playableHeight - Math.max(0, laneCount - 1) * LANE_GAP) / laneCount)
    )
    const totalHeight = laneHeight * laneCount + Math.max(0, laneCount - 1) * LANE_GAP
    const topOffset = HEADER_HEIGHT + Math.max(16, (playableHeight - totalHeight) / 2)
    const left = 30
    const laneWidth = Math.max(300, width - 60)

    return Array.from({ length: laneCount }, (_, index) => ({
        index,
        x: left,
        y: topOffset + index * (laneHeight + LANE_GAP),
        width: laneWidth,
        height: laneHeight
    }))
}

function createLaneScene(layout, fellow, laneIndex, MatterLib) {
    const { Bodies, Body } = MatterLib
    const lanePadding = 22
    const extraPullSpace = layout.width * 0.08
    const ballRadius = layout.height / 10
    const ballDiameter = ballRadius * 2
    const startX = layout.x + LANE_INSET + lanePadding + ballRadius + extraPullSpace
    const centerY = layout.y + layout.height / 2
    const pinRadius = Math.max(6, Math.min(10, layout.height * 0.058))
    const pinSpacingX = pinRadius * 3.5
    const pinSpacingY = pinRadius * 3.1

    const ball = Bodies.circle(startX, centerY, ballRadius, {
        restitution: BALL_RESTITUTION,
        friction: 0.012,
        frictionAir: BALL_FRICTION_AIR,
        density: 0.004,
        label: `lane-ball-${laneIndex}`
    })
    Body.setStatic(ball, true)

    const pinRows = [1, 2, 3, 4]
    const pins = []
    const firstPinX = layout.x + layout.width * 0.72

    pinRows.forEach((rowSize, rowIndex) => {
        const x = firstPinX + rowIndex * pinSpacingX
        const yOffsetBase = -((rowSize - 1) * pinSpacingY) / 2

        for (let index = 0; index < rowSize; index += 1) {
            const pin = Bodies.circle(x, centerY + yOffsetBase + index * pinSpacingY, pinRadius, {
                restitution: PIN_RESTITUTION,
                friction: 0.03,
                frictionAir: PIN_FRICTION_AIR,
                density: 0.0021,
                label: `lane-pin-${laneIndex}-${pins.length + 1}`
            })

            pin.plugin.initialPosition = {
                x: pin.position.x,
                y: pin.position.y
            }
            pins.push(pin)
        }
    })

    return {
        id: `lane-${laneIndex}-${fellow.id || fellow.label}`,
        fellow,
        layout,
        ball,
        ballRadius,
        ballDiameter,
        pinRadius,
        anchor: { x: startX, y: centerY },
        pins,
        hasLaunched: false,
        knockedPins: 0
    }
}

function clampBodyToLane(body, radius, layout, MatterLib) {
    const minX = layout.x + LANE_INSET + radius
    const maxX = layout.x + layout.width - LANE_INSET - radius
    const minY = layout.y + LANE_INSET + radius
    const maxY = layout.y + layout.height - LANE_INSET - radius
    const hitX = body.position.x < minX || body.position.x > maxX
    const hitY = body.position.y < minY || body.position.y > maxY
    const nextX = clamp(body.position.x, minX, maxX)
    const nextY = clamp(body.position.y, minY, maxY)

    if (hitX || hitY) {
        MatterLib.Body.setPosition(body, { x: nextX, y: nextY })
        MatterLib.Body.setVelocity(body, {
            x: hitX ? 0 : body.velocity.x,
            y: hitY ? 0 : body.velocity.y
        })
    }
}

function FellowBowlingGameModal({ fellows, onClose }) {
    const selectedFellows = useMemo(() => fellows.slice(0, MAX_LANES), [fellows])
    const [viewport, setViewport] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    })
    const [dragState, setDragState] = useState(null)
    const [laneSummaries, setLaneSummaries] = useState(() =>
        selectedFellows.map((fellow) => ({
            id: fellow.id || fellow.label,
            knockedPins: 0,
            hasLaunched: false
        }))
    )
    const [resetToken, setResetToken] = useState(0)

    const laneScenesRef = useRef([])
    const animationFrameRef = useRef(0)
    const activePointerRef = useRef(null)
    const ballNodeRefs = useRef(new Map())
    const pinNodeRefs = useRef(new Map())
    const lastSummaryKeyRef = useRef('')

    const laneLayouts = useMemo(
        () => buildLaneLayouts(viewport.width, viewport.height, selectedFellows.length),
        [selectedFellows.length, viewport.height, viewport.width]
    )

    useEffect(() => {
        setLaneSummaries(
            selectedFellows.map((fellow) => ({
                id: fellow.id || fellow.label,
                knockedPins: 0,
                hasLaunched: false
            }))
        )
    }, [selectedFellows])

    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight
            })
        }

        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    useEffect(() => {
        if (!selectedFellows.length) {
            return undefined
        }

        const { Engine, World } = Matter
        const engine = Engine.create({
            gravity: { x: 0, y: 0 }
        })
        const nextScenes = selectedFellows.map((fellow, index) =>
            createLaneScene(laneLayouts[index], fellow, index, Matter)
        )
        laneScenesRef.current = nextScenes
        lastSummaryKeyRef.current = ''

        World.add(
            engine.world,
            nextScenes.flatMap((scene) => [scene.ball, ...scene.pins])
        )

        const syncNodeTransform = (node, x, y, angle) => {
            if (!node) {
                return
            }

            node.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`
        }

        const updateLaneSummaries = () => {
            const nextSummaries = nextScenes.map((scene) => {
                const knockedPins = scene.pins.reduce((count, pin) => {
                    const initialPosition = pin.plugin.initialPosition
                    const distance = Math.hypot(
                        pin.position.x - initialPosition.x,
                        pin.position.y - initialPosition.y
                    )

                    if (distance >= PIN_KNOCK_DISTANCE || Math.abs(pin.angle) >= PIN_KNOCK_ANGLE) {
                        return count + 1
                    }

                    return count
                }, 0)

                scene.knockedPins = knockedPins

                return {
                    id: scene.fellow.id || scene.fellow.label,
                    knockedPins,
                    hasLaunched: scene.hasLaunched
                }
            })
            const summaryKey = JSON.stringify(nextSummaries)

            if (summaryKey !== lastSummaryKeyRef.current) {
                lastSummaryKeyRef.current = summaryKey
                setLaneSummaries(nextSummaries)
            }
        }

        const renderLoop = () => {
            Engine.update(engine, 1000 / 60)

            nextScenes.forEach((scene) => {
                clampBodyToLane(scene.ball, scene.ballRadius, scene.layout, Matter)
                scene.pins.forEach((pin) => {
                    clampBodyToLane(pin, scene.pinRadius, scene.layout, Matter)
                })

                const ballNode = ballNodeRefs.current.get(scene.id)
                syncNodeTransform(
                    ballNode,
                    scene.ball.position.x - scene.layout.x - scene.ballRadius,
                    scene.ball.position.y - scene.layout.y - scene.ballRadius,
                    scene.ball.angle
                )

                scene.pins.forEach((pin, index) => {
                    const pinNode = pinNodeRefs.current.get(`${scene.id}-pin-${index}`)
                    syncNodeTransform(
                        pinNode,
                        pin.position.x - scene.layout.x - scene.pinRadius,
                        pin.position.y - scene.layout.y - scene.pinRadius,
                        pin.angle
                    )
                })
            })

            updateLaneSummaries()
            animationFrameRef.current = window.requestAnimationFrame(renderLoop)
        }

        animationFrameRef.current = window.requestAnimationFrame(renderLoop)

        return () => {
            window.cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = 0
            World.clear(engine.world, false)
            Engine.clear(engine)
            laneScenesRef.current = []
        }
    }, [laneLayouts, resetToken, selectedFellows])

    useEffect(() => {
        const handlePointerMove = (event) => {
            const activePointer = activePointerRef.current
            if (!activePointer) {
                return
            }

            const scene = laneScenesRef.current.find((entry) => entry.id === activePointer.laneId)
            if (!scene) {
                return
            }

            const dragX = clamp(
                event.clientX,
                scene.layout.x + scene.ballRadius + 12,
                scene.anchor.x
            )
            const dragY = clamp(
                event.clientY,
                scene.layout.y + scene.ballRadius + 12,
                scene.layout.y + scene.layout.height - scene.ballRadius - 12
            )
            const deltaX = scene.anchor.x - dragX
            const deltaY = scene.anchor.y - dragY
            const distance = Math.hypot(deltaX, deltaY)

            let nextX = dragX
            let nextY = dragY

            if (distance > MAX_PULL_DISTANCE) {
                const ratio = MAX_PULL_DISTANCE / distance
                nextX = scene.anchor.x - deltaX * ratio
                nextY = scene.anchor.y - deltaY * ratio
            }

            Matter.Body.setPosition(scene.ball, { x: nextX, y: nextY })
            Matter.Body.setVelocity(scene.ball, { x: 0, y: 0 })
            Matter.Body.setAngularVelocity(scene.ball, 0)

            setDragState({
                laneId: scene.id,
                ballX: nextX,
                ballY: nextY,
                arrowX: scene.anchor.x,
                arrowY: scene.anchor.y
            })
        }

        const handlePointerUp = () => {
            const activePointer = activePointerRef.current
            if (!activePointer) {
                return
            }

            const scene = laneScenesRef.current.find((entry) => entry.id === activePointer.laneId)
            activePointerRef.current = null
            setDragState(null)

            if (!scene) {
                return
            }

            const launchVector = {
                x: scene.anchor.x - scene.ball.position.x,
                y: scene.anchor.y - scene.ball.position.y
            }
            const pullDistance = Math.hypot(launchVector.x, launchVector.y)
            const cappedPullDistance = Math.min(pullDistance, scene.ballDiameter)
            const speedRatio = clamp(cappedPullDistance / scene.ballDiameter, 0, 1)
            const directionX = pullDistance > 0 ? launchVector.x / pullDistance : 0
            const directionY = pullDistance > 0 ? launchVector.y / pullDistance : 0
            const laneRightLimit = scene.layout.x + scene.layout.width - LANE_INSET - scene.ballRadius
            const availableTravel = Math.max(0, laneRightLimit - scene.anchor.x)
            const maxLaunchSpeed =
                availableTravel * BALL_FRICTION_AIR * BALL_MAX_TRAVEL_MARGIN
            const launchSpeed = maxLaunchSpeed * speedRatio

            Matter.Body.setStatic(scene.ball, false)
            Matter.Body.setVelocity(scene.ball, {
                x: directionX * launchSpeed,
                y: directionY * launchSpeed
            })
            Matter.Body.setAngularVelocity(cappedPullDistance * 0.0024)
            scene.hasLaunched = pullDistance > 8

            if (!scene.hasLaunched) {
                Matter.Body.setPosition(scene.ball, scene.anchor)
                Matter.Body.setStatic(scene.ball, true)
            }
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
        window.addEventListener('pointercancel', handlePointerUp)

        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
            window.removeEventListener('pointercancel', handlePointerUp)
        }
    }, [])

    const registerBallNode = (laneId, node) => {
        if (!node) {
            ballNodeRefs.current.delete(laneId)
            return
        }

        ballNodeRefs.current.set(laneId, node)
    }

    const registerPinNode = (pinId, node) => {
        if (!node) {
            pinNodeRefs.current.delete(pinId)
            return
        }

        pinNodeRefs.current.set(pinId, node)
    }

    const handleBallPointerDown = (laneId, event) => {
        const scene = laneScenesRef.current.find((entry) => entry.id === laneId)
        if (!scene || scene.hasLaunched) {
            return
        }

        event.preventDefault()
        activePointerRef.current = { laneId }
        Matter.Body.setStatic(scene.ball, true)
        Matter.Body.setVelocity(scene.ball, { x: 0, y: 0 })
        Matter.Body.setAngularVelocity(scene.ball, 0)
        setDragState({
            laneId: scene.id,
            ballX: scene.ball.position.x,
            ballY: scene.ball.position.y,
            arrowX: scene.anchor.x,
            arrowY: scene.anchor.y
        })
    }

    const handleReset = () => {
        setDragState(null)
        activePointerRef.current = null
        setResetToken((current) => current + 1)
    }

    return (
        <div className='fellow-bowling-modal'>
            <button type='button' className='fellow-bowling-close' onClick={onClose}>
                Close
            </button>
            <div className='fellow-bowling-shell'>
                <header className='fellow-bowling-header'>
                    <div>
                        <p className='fellow-bowling-kicker'>Jackpot Effect</p>
                        <div className='fellow-bowling-title-row'>
                            <h2>Fellow Bowling</h2>
                            <button
                                type='button'
                                className='fellow-bowling-reset'
                                onClick={handleReset}>
                                Reset Lanes
                            </button>
                        </div>
                        <p className='fellow-bowling-copy'>
                            Pull each avatar ball to the left and release to roll right into the pins.
                        </p>
                    </div>
                </header>

                <div className='fellow-bowling-lanes'>
                    {selectedFellows.map((fellow, index) => {
                        const scene = laneScenesRef.current[index]
                        const layout = laneLayouts[index]
                        const summary = laneSummaries[index]
                        const laneId = scene?.id || `lane-${index}-${fellow.id || fellow.label}`
                        const ballDiameter = scene?.ballDiameter || layout.height / 5
                        const ballBorderWidth = Math.max(2, Math.round(ballDiameter * 0.07))
                        const pinDiameter = scene?.pinRadius ? scene.pinRadius * 2 : layout.height * 0.116

                        return (
                            <section
                                key={laneId}
                                className='fellow-bowling-lane'
                                style={{
                                    top: `${layout.y}px`,
                                    left: `${layout.x}px`,
                                    width: `${layout.width}px`,
                                    height: `${layout.height}px`
                                }}>
                                <div className='fellow-bowling-lane-label'>
                                    <span>Lane {index + 1}</span>
                                    <strong>{fellow.label}</strong>
                                    <small>
                                        {summary?.knockedPins || 0}/10 pins down
                                    </small>
                                </div>

                                {dragState?.laneId === laneId ? (
                                    <svg className='fellow-bowling-drag-line' viewBox={`0 0 ${layout.width} ${layout.height}`}>
                                        <defs>
                                            <marker
                                                id={`fellow-bowling-arrow-${laneId}`}
                                                markerWidth='12'
                                                markerHeight='12'
                                                refX='10'
                                                refY='6'
                                                orient='auto'>
                                                <path d='M0,0 L12,6 L0,12 z' fill='#ffd468' />
                                            </marker>
                                        </defs>
                                        <line
                                            x1={dragState.ballX - layout.x}
                                            y1={dragState.ballY - layout.y}
                                            x2={dragState.arrowX - layout.x}
                                            y2={dragState.arrowY - layout.y}
                                            stroke='#ffd468'
                                            strokeWidth='4'
                                            strokeDasharray='10 10'
                                            strokeLinecap='round'
                                            markerEnd={`url(#fellow-bowling-arrow-${laneId})`}
                                        />
                                    </svg>
                                ) : null}

                                <button
                                    type='button'
                                    ref={(node) => registerBallNode(laneId, node)}
                                    className={`fellow-bowling-ball ${summary?.hasLaunched ? 'is-launched' : ''}`}
                                    onPointerDown={(event) => handleBallPointerDown(laneId, event)}
                                    style={{
                                        width: `${ballDiameter}px`,
                                        height: `${ballDiameter}px`,
                                        borderWidth: `${ballBorderWidth}px`
                                    }}
                                    aria-label={`Launch ${fellow.label} bowling ball`}>
                                    {fellow.avatarSrc ? (
                                        <img
                                            src={fellow.avatarSrc}
                                            alt={fellow.label}
                                            className='fellow-bowling-ball-avatar'
                                            onError={(event) => {
                                                event.currentTarget.onerror = null
                                                event.currentTarget.src =
                                                    fellow.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                            }}
                                        />
                                    ) : (
                                        <span className='fellow-bowling-ball-fallback'>
                                            {fellow.displayLabel || fellow.id}
                                        </span>
                                    )}
                                </button>

                                {(scene?.pins || Array.from({ length: 10 })).map((pin, pinIndex) => (
                                    <div
                                        key={`${laneId}-pin-${pinIndex}`}
                                        ref={(node) => registerPinNode(`${laneId}-pin-${pinIndex}`, node)}
                                        className='fellow-bowling-pin'
                                        style={{
                                            width: `${pinDiameter}px`,
                                            height: `${pinDiameter}px`
                                        }}
                                    />
                                ))}
                            </section>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default FellowBowlingGameModal
