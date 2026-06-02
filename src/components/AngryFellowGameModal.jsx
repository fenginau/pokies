import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import { DEFAULT_FELLOW_AVATAR_SRC } from '../constants/assets'

const WORLD_WIDTH = 1366
const WORLD_HEIGHT = 768
const GROUND_HEIGHT = 92
const WALL_THICKNESS = 160
const PLAYER_RADIUS = 34
const VILLAIN_RADIUS = 34
const PLAYER_PULL_LIMIT = 134
const SHOT_SPEED_MULTIPLIER = 0.17
const SHOT_IDLE_LINEAR_SPEED = 0.28
const SHOT_IDLE_ANGULAR_SPEED = 0.03
const SHOT_IDLE_FRAMES = 24
const KILL_DISTANCE = 92
const KILL_ANGLE = 0.95
const BLOCK_DENSITY = 0.0026
const MIN_SHOTS = 3
const MAX_SHOTS = 5
const STORY_HEIGHT = 146
const FLOOR_BEAM_HEIGHT = 18
const FLOOR_CELL_WIDTH = 112
const STRUCTURE_CENTER_X = WORLD_WIDTH * 0.72
const STRUCTURE_BASE_Y = WORLD_HEIGHT - GROUND_HEIGHT - 10
const FLOOR_CLEARANCE = 16

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min)
}

function shuffle(items) {
    const nextItems = [...items]

    for (let index = nextItems.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]]
    }

    return nextItems
}

function choose(items) {
    return items[Math.floor(Math.random() * items.length)]
}

function pickVillains(fellows, playerId, count) {
    const candidates = fellows.filter((fellow) => fellow.id !== playerId)
    if (!candidates.length) {
        return []
    }

    const villains = []
    let queue = shuffle(candidates)

    while (villains.length < count) {
        if (!queue.length) {
            queue = shuffle(candidates)
        }

        villains.push(queue.pop())
    }

    return villains
}

function createBlockBody(MatterLib, block, centerX, centerY) {
    const { Bodies } = MatterLib

    if (block.variant === 'triangle') {
        return Bodies.polygon(centerX, centerY, 3, block.width * 0.66, {
            density: BLOCK_DENSITY,
            friction: 0.72,
            frictionStatic: 0.96,
            restitution: 0.02,
            label: `angry-block-${block.id}`
        })
    }

    if (block.variant === 'circle') {
        return Bodies.circle(centerX, centerY, block.width / 2, {
            density: BLOCK_DENSITY,
            friction: 0.78,
            frictionStatic: 0.96,
            restitution: 0.02,
            label: `angry-block-${block.id}`
        })
    }

    if (block.variant === 'diamond') {
        return Bodies.polygon(centerX, centerY, 4, block.width * 0.52, {
            density: BLOCK_DENSITY,
            friction: 0.78,
            frictionStatic: 0.96,
            restitution: 0.02,
            angle: Math.PI / 4,
            label: `angry-block-${block.id}`
        })
    }

    if (block.variant === 'pentagon') {
        return Bodies.polygon(centerX, centerY, 5, block.width * 0.56, {
            density: BLOCK_DENSITY,
            friction: 0.78,
            frictionStatic: 0.96,
            restitution: 0.02,
            label: `angry-block-${block.id}`
        })
    }

    if (block.variant === 'hexagon') {
        return Bodies.polygon(centerX, centerY, 6, block.width * 0.56, {
            density: BLOCK_DENSITY,
            friction: 0.8,
            frictionStatic: 0.98,
            restitution: 0.02,
            label: `angry-block-${block.id}`
        })
    }

    return Bodies.rectangle(centerX, centerY, block.width, block.height, {
        density: BLOCK_DENSITY,
        friction: 0.82,
        frictionStatic: 1,
        restitution: 0.01,
        label: `angry-block-${block.id}`
    })
}

function createLevelDistributions(villainCount) {
    const distributions = {
        3: [
            [3],
            [2, 1]
        ],
        4: [
            [4],
            [3, 1],
            [2, 2]
        ],
        5: [
            [5],
            [3, 2],
            [2, 2, 1],
            [3, 1, 1]
        ]
    }

    return distributions[villainCount] || [[villainCount]]
}

function createSupportPositions(centerX, width, count) {
    if (count <= 1) {
        return [centerX]
    }

    const spacing = width / (count - 1)
    return Array.from({ length: count }, (_, index) => centerX - width / 2 + spacing * index)
}

function createFortressLayout(villains) {
    const levelCounts = choose(createLevelDistributions(villains.length))
    const levels = []
    let villainIndex = 0

    levelCounts.forEach((count, levelIndex) => {
        levels.push({
            storyIndex: levelIndex,
            villains: villains.slice(villainIndex, villainIndex + count)
        })
        villainIndex += count
    })

    const blocks = []
    const villainBodies = []
    const levelFrames = []
    const foundationWidth = Math.max(250, levelCounts[0] * FLOOR_CELL_WIDTH + 148)

    blocks.push({
        id: 'foundation',
        variant: 'rectangle',
        width: foundationWidth,
        height: 22,
        x: STRUCTURE_CENTER_X,
        y: STRUCTURE_BASE_Y + 12
    })

    levels.forEach((level) => {
        const count = level.villains.length
        const beamWidth = count * FLOOR_CELL_WIDTH + 42
        const beamY = STRUCTURE_BASE_Y - 102 - level.storyIndex * STORY_HEIGHT
        const supportBaseY =
            level.storyIndex === 0
                ? STRUCTURE_BASE_Y + 1
                : levelFrames[level.storyIndex - 1].beamY - FLOOR_BEAM_HEIGHT / 2
        const supportHeight = supportBaseY - beamY - FLOOR_BEAM_HEIGHT / 2
        const supportCount = Math.max(2, Math.min(count + 1, 4))
        const supportSpread = beamWidth * (supportCount === 2 ? 0.62 : 0.72)
        const supportXs = createSupportPositions(STRUCTURE_CENTER_X, supportSpread, supportCount)
        const villainSpacing = count > 1 ? (beamWidth - 52) / (count - 1) : 0
        const villainStartX = STRUCTURE_CENTER_X - (beamWidth - 52) / 2

        supportXs.forEach((supportX, supportIndex) => {
            blocks.push({
                id: `story-${level.storyIndex}-pillar-${supportIndex}`,
                variant: 'pillar',
                width: 18,
                height: supportHeight,
                x: supportX,
                y: supportBaseY - supportHeight / 2
            })
        })

        blocks.push({
            id: `story-${level.storyIndex}-beam`,
            variant: 'rectangle',
            width: beamWidth,
            height: FLOOR_BEAM_HEIGHT,
            x: STRUCTURE_CENTER_X,
            y: beamY
        })

        level.villains.forEach((villain, index) => {
            const x = count === 1 ? STRUCTURE_CENTER_X : villainStartX + villainSpacing * index
            villainBodies.push({
                villain,
                x,
                y: beamY - FLOOR_CLEARANCE - VILLAIN_RADIUS,
                renderId: `${villain.id}-${villainBodies.length}`
            })
        })

        if (level.storyIndex === 0 && count >= 3) {
            blocks.push({
                id: `story-${level.storyIndex}-cradle-left`,
                variant: 'pillar',
                width: 12,
                height: 28,
                x: STRUCTURE_CENTER_X - 22,
                y: STRUCTURE_BASE_Y - 3
            })
            blocks.push({
                id: `story-${level.storyIndex}-cradle-right`,
                variant: 'pillar',
                width: 12,
                height: 28,
                x: STRUCTURE_CENTER_X + 22,
                y: STRUCTURE_BASE_Y - 3
            })
            blocks.push({
                id: `story-${level.storyIndex}-counterweight-center`,
                variant: 'circle',
                width: 28,
                height: 28,
                x: STRUCTURE_CENTER_X,
                y: STRUCTURE_BASE_Y - 8
            })
            blocks.push({
                id: `story-${level.storyIndex}-pedestal-left`,
                variant: 'rectangle',
                width: 30,
                height: 12,
                x: STRUCTURE_CENTER_X - foundationWidth / 2 + 56,
                y: STRUCTURE_BASE_Y - 5
            })
            blocks.push({
                id: `story-${level.storyIndex}-pedestal-right`,
                variant: 'rectangle',
                width: 30,
                height: 12,
                x: STRUCTURE_CENTER_X + foundationWidth / 2 - 56,
                y: STRUCTURE_BASE_Y - 5
            })
            blocks.push({
                id: `story-${level.storyIndex}-shape-left`,
                variant: 'hexagon',
                width: 24,
                height: 24,
                x: STRUCTURE_CENTER_X - foundationWidth / 2 + 56,
                y: STRUCTURE_BASE_Y - 23
            })
            blocks.push({
                id: `story-${level.storyIndex}-shape-right`,
                variant: 'pentagon',
                width: 24,
                height: 24,
                x: STRUCTURE_CENTER_X + foundationWidth / 2 - 56,
                y: STRUCTURE_BASE_Y - 23
            })
        }

        levelFrames.push({
            beamY,
            beamWidth
        })
    })

    return {
        villainBodies,
        blocks
    }
}

function AngryFellowGameModal({ player, fellows, shotCount, onClose }) {
    const [currentShotCount, setCurrentShotCount] = useState(shotCount)
    const [roundSeed, setRoundSeed] = useState(0)
    const [resetToken, setResetToken] = useState(0)
    const [viewport, setViewport] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    })
    const [status, setStatus] = useState('ready')
    const [shotsLeft, setShotsLeft] = useState(shotCount)
    const [villainsLeft, setVillainsLeft] = useState(0)
    const [dragState, setDragState] = useState(null)
    const [killedVillainIds, setKilledVillainIds] = useState([])
    const [renderBlocks, setRenderBlocks] = useState([])
    const roundConfig = useMemo(() => {
        const villains = pickVillains(fellows, player.id, currentShotCount)
        return {
            villains,
            layout: createFortressLayout(villains)
        }
    }, [currentShotCount, fellows, player.id, roundSeed])

    const worldRef = useRef(null)
    const animationFrameRef = useRef(0)
    const pointerIdRef = useRef(null)
    const pointerTargetRef = useRef(null)
    const playerNodeRef = useRef(null)
    const boardRef = useRef(null)
    const villainNodeRefs = useRef(new Map())
    const blockNodeRefs = useRef(new Map())
    const sceneRef = useRef({
        playerBody: null,
        anchor: { x: 0, y: 0 },
        villainBodies: [],
        blockBodies: [],
        hasShotInFlight: false,
        settleFrames: 0,
        isDragging: false,
        shotsUsed: 0,
        killed: new Set(),
        pendingShotLoss: false
    })

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
        const { Engine, World, Bodies, Body } = Matter
        const engine = Engine.create({
            enableSleeping: true,
            gravity: { x: 0, y: 0.96 }
        })
        setShotsLeft(currentShotCount)
        setVillainsLeft(roundConfig.villains.length)
        setKilledVillainIds([])
        setDragState(null)
        pointerIdRef.current = null
        pointerTargetRef.current = null

        const anchor = {
            x: WORLD_WIDTH * 0.2,
            y: WORLD_HEIGHT - GROUND_HEIGHT - 110
        }
        const playerBody = Bodies.circle(anchor.x, anchor.y, PLAYER_RADIUS, {
            restitution: 0.24,
            friction: 0.022,
            frictionStatic: 0.45,
            frictionAir: 0.012,
            density: 0.0022,
            label: `angry-player-${player.id}`
        })
        Body.setStatic(playerBody, true)

        const boundaries = [
            Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - GROUND_HEIGHT / 2, WORLD_WIDTH + 800, GROUND_HEIGHT, {
                isStatic: true,
                label: 'angry-ground'
            }),
            Bodies.rectangle(-WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT * 2, {
                isStatic: true,
                label: 'angry-left-wall'
            }),
            Bodies.rectangle(WORLD_WIDTH + WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT * 2, {
                isStatic: true,
                label: 'angry-right-wall'
            }),
            Bodies.rectangle(WORLD_WIDTH / 2, -WALL_THICKNESS / 2, WORLD_WIDTH * 2, WALL_THICKNESS, {
                isStatic: true,
                label: 'angry-top-wall'
            })
        ]

        const fortress = roundConfig.layout
        const villainBodies = fortress.villainBodies.map((entry) => {
            const body = Bodies.circle(entry.x, entry.y, VILLAIN_RADIUS, {
                restitution: 0.12,
                friction: 0.54,
                frictionStatic: 0.84,
                frictionAir: 0.02,
                density: 0.0022,
                label: `angry-villain-${entry.villain.id}`
            })
            body.sleepThreshold = Infinity

            body.plugin.initialState = {
                x: body.position.x,
                y: body.position.y,
                angle: body.angle
            }
            body.plugin.villain = entry.villain
            body.plugin.renderId = entry.renderId
            return body
        })
        const blockBodies = fortress.blocks.map((block) => {
            const nextBody = createBlockBody(Matter, block, block.x, block.y)
            nextBody.plugin.block = block
            nextBody.plugin.renderId = block.id
            nextBody.sleepThreshold = 90
            return nextBody
        })
        setRenderBlocks(
            blockBodies.map((body) => ({
                renderId: body.plugin.renderId,
                block: body.plugin.block
            }))
        )

        World.add(engine.world, [...boundaries, playerBody, ...villainBodies, ...blockBodies])
        worldRef.current = engine
        sceneRef.current = {
            playerBody,
            anchor,
            villainBodies,
            blockBodies,
            hasShotInFlight: false,
            settleFrames: 0,
            isDragging: false,
            shotsUsed: 0,
            killed: new Set(),
            pendingShotLoss: false
        }
        setStatus('playing')

        const resetPlayerBody = () => {
            const scene = sceneRef.current
            Body.setStatic(scene.playerBody, true)
            Body.setPosition(scene.playerBody, scene.anchor)
            Body.setVelocity(scene.playerBody, { x: 0, y: 0 })
            Body.setAngle(scene.playerBody, 0)
            Body.setAngularVelocity(scene.playerBody, 0)
            scene.hasShotInFlight = false
            scene.pendingShotLoss = false
            scene.settleFrames = 0
        }

        const syncTransform = (node, body, radiusX, radiusY) => {
            if (!node) {
                return
            }

            node.style.transform = `translate(${body.position.x - radiusX}px, ${
                body.position.y - radiusY
            }px) rotate(${body.angle}rad)`
        }

        const endGameIfNeeded = () => {
            const scene = sceneRef.current
            const aliveCount = scene.villainBodies.length - scene.killed.size

            if (aliveCount <= 0) {
                setVillainsLeft(0)
                setStatus('won')
                return true
            }

            if (scene.shotsUsed >= currentShotCount && !scene.hasShotInFlight) {
                setStatus('lost')
                return true
            }

            return false
        }

        const removeVillain = (body) => {
            const scene = sceneRef.current
            if (scene.killed.has(body.plugin.renderId)) {
                return
            }

            scene.killed.add(body.plugin.renderId)
            const nextAliveCount = scene.villainBodies.length - scene.killed.size
            setVillainsLeft(nextAliveCount)
            setKilledVillainIds((current) => [...current, body.plugin.renderId])

            window.setTimeout(() => {
                if (!worldRef.current) {
                    return
                }

                Matter.World.remove(worldRef.current.world, body)
            }, 280)
        }

        const updateKills = () => {
            sceneRef.current.villainBodies.forEach((body) => {
                if (sceneRef.current.killed.has(body.plugin.renderId)) {
                    return
                }

                const initialState = body.plugin.initialState
                const movedDistance = Math.hypot(
                    body.position.x - initialState.x,
                    body.position.y - initialState.y
                )
                const spinDelta = Math.abs(body.angle - initialState.angle)

                if (movedDistance >= KILL_DISTANCE || spinDelta >= KILL_ANGLE) {
                    removeVillain(body)
                }
            })
        }

        const step = () => {
            Engine.update(engine, 1000 / 60)

            const scene = sceneRef.current
            scene.villainBodies.forEach((body) => {
                if (!scene.killed.has(body.plugin.renderId)) {
                    Matter.Sleeping.set(body, false)
                }
            })
            updateKills()

            syncTransform(playerNodeRef.current, scene.playerBody, PLAYER_RADIUS, PLAYER_RADIUS)

            scene.villainBodies.forEach((body) => {
                const node = villainNodeRefs.current.get(body.plugin.renderId)
                syncTransform(node, body, VILLAIN_RADIUS, VILLAIN_RADIUS)
            })

            scene.blockBodies.forEach((body) => {
                const block = body.plugin.block
                const node = blockNodeRefs.current.get(body.plugin.renderId)
                syncTransform(node, body, block.width / 2, block.height / 2)
            })

            if (scene.hasShotInFlight) {
                const isPlayerSlow =
                    Math.abs(scene.playerBody.velocity.x) < SHOT_IDLE_LINEAR_SPEED &&
                    Math.abs(scene.playerBody.velocity.y) < SHOT_IDLE_LINEAR_SPEED &&
                    Math.abs(scene.playerBody.angularVelocity) < SHOT_IDLE_ANGULAR_SPEED

                if (isPlayerSlow) {
                    scene.settleFrames += 1
                } else {
                    scene.settleFrames = 0
                }

                const isOutOfBounds =
                    scene.playerBody.position.x > WORLD_WIDTH + 120 ||
                    scene.playerBody.position.y > WORLD_HEIGHT + 160 ||
                    scene.playerBody.position.x < -120

                if (scene.settleFrames >= SHOT_IDLE_FRAMES || isOutOfBounds) {
                    scene.shotsUsed += 1
                    setShotsLeft(Math.max(0, currentShotCount - scene.shotsUsed))
                    resetPlayerBody()
                    endGameIfNeeded()
                }
            }

            if (!endGameIfNeeded()) {
                animationFrameRef.current = window.requestAnimationFrame(step)
            }
        }

        resetPlayerBody()
        animationFrameRef.current = window.requestAnimationFrame(step)

        return () => {
            window.cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = 0
            World.clear(engine.world, false)
            Engine.clear(engine)
            worldRef.current = null
            setRenderBlocks([])
        }
    }, [currentShotCount, player.id, resetToken, roundConfig])

    useEffect(() => {
        const handlePointerMove = (event) => {
            if (pointerIdRef.current !== event.pointerId) {
                return
            }

            const scene = sceneRef.current
            if (!scene.playerBody || !scene.isDragging || status !== 'playing') {
                return
            }

            const rect = boardRef.current?.getBoundingClientRect()
            const scale = rect ? rect.width / WORLD_WIDTH : viewport.width / WORLD_WIDTH
            const worldX = clamp(
                (event.clientX - (rect?.left || 0)) / scale,
                scene.anchor.x - PLAYER_PULL_LIMIT,
                scene.anchor.x + 16
            )
            const worldY = clamp(
                (event.clientY - (rect?.top || 0)) / scale,
                scene.anchor.y - PLAYER_PULL_LIMIT,
                scene.anchor.y + PLAYER_PULL_LIMIT * 0.66
            )
            const deltaX = worldX - scene.anchor.x
            const deltaY = worldY - scene.anchor.y
            const distance = Math.hypot(deltaX, deltaY)
            const ratio = distance > PLAYER_PULL_LIMIT ? PLAYER_PULL_LIMIT / distance : 1
            const nextX = scene.anchor.x + deltaX * ratio
            const nextY = scene.anchor.y + deltaY * ratio

            Matter.Body.setPosition(scene.playerBody, { x: nextX, y: nextY })
            setDragState({
                x: nextX,
                y: nextY,
                anchorX: scene.anchor.x,
                anchorY: scene.anchor.y
            })
        }

        const handlePointerUp = (event) => {
            if (pointerIdRef.current !== event.pointerId) {
                return
            }

            if (pointerTargetRef.current?.hasPointerCapture?.(event.pointerId)) {
                pointerTargetRef.current.releasePointerCapture(event.pointerId)
            }

            pointerIdRef.current = null
            pointerTargetRef.current = null
            const scene = sceneRef.current
            if (!scene.playerBody || !scene.isDragging || status !== 'playing') {
                setDragState(null)
                return
            }

            scene.isDragging = false
            const launchVector = {
                x: scene.anchor.x - scene.playerBody.position.x,
                y: scene.anchor.y - scene.playerBody.position.y
            }
            const pullDistance = Math.hypot(launchVector.x, launchVector.y)
            setDragState(null)

            if (pullDistance < 12) {
                Matter.Body.setPosition(scene.playerBody, scene.anchor)
                return
            }

            Matter.Body.setStatic(scene.playerBody, false)
            Matter.Sleeping.set(scene.playerBody, false)
            Matter.Body.setVelocity(scene.playerBody, {
                x: launchVector.x * SHOT_SPEED_MULTIPLIER,
                y: launchVector.y * SHOT_SPEED_MULTIPLIER
            })
            Matter.Body.setAngularVelocity(scene.playerBody, pullDistance * 0.0022)
            scene.hasShotInFlight = true
            scene.settleFrames = 0
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
        window.addEventListener('pointercancel', handlePointerUp)

        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
            window.removeEventListener('pointercancel', handlePointerUp)
        }
    }, [status, viewport.width])

    const registerVillainNode = (id, node) => {
        if (!node) {
            villainNodeRefs.current.delete(id)
            return
        }

        villainNodeRefs.current.set(id, node)
    }

    const registerBlockNode = (id, node) => {
        if (!node) {
            blockNodeRefs.current.delete(id)
            return
        }

        blockNodeRefs.current.set(id, node)
    }

    const handlePlayerPointerDown = (event) => {
        if (status !== 'playing') {
            return
        }

        const scene = sceneRef.current
        if (scene.hasShotInFlight || scene.shotsUsed >= currentShotCount) {
            return
        }

        event.preventDefault()
        pointerIdRef.current = event.pointerId
        pointerTargetRef.current = event.currentTarget
        event.currentTarget.setPointerCapture?.(event.pointerId)
        scene.isDragging = true
        Matter.Body.setStatic(scene.playerBody, true)
        Matter.Sleeping.set(scene.playerBody, false)
        Matter.Body.setVelocity(scene.playerBody, { x: 0, y: 0 })
        Matter.Body.setAngularVelocity(scene.playerBody, 0)
        setDragState({
            x: scene.playerBody.position.x,
            y: scene.playerBody.position.y,
            anchorX: scene.anchor.x,
            anchorY: scene.anchor.y
        })
    }

    const handleReset = () => {
        setResetToken((current) => current + 1)
    }

    const handleNewGame = () => {
        setCurrentShotCount(randomInt(MIN_SHOTS, MAX_SHOTS))
        setRoundSeed((current) => current + 1)
        setResetToken((current) => current + 1)
    }

    const scale = Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT)
    const sceneWidth = WORLD_WIDTH * scale
    const sceneHeight = WORLD_HEIGHT * scale

    return (
        <div className='angry-fellow-modal' role='dialog' aria-modal='true'>
            <button type='button' className='angry-fellow-close' onClick={onClose} aria-label='Close game'>
                ×
            </button>

            <div className='angry-fellow-shell'>
                <header className='angry-fellow-header'>
                    <p className='angry-fellow-kicker'>Jackpot Effect</p>
                    <div className='angry-fellow-title-row'>
                        <div>
                            <h2>{`Angry ${player.label}`}</h2>
                            <p>
                                Pull back the avatar sling, break the cover, and knock every villain off
                                balance.
                            </p>
                        </div>
                        <div className='angry-fellow-sidecar'>
                            <div className='angry-fellow-stats' aria-hidden='true'>
                                <div className='angry-fellow-stat'>
                                    <span>Shots</span>
                                    <strong>{shotsLeft}</strong>
                                </div>
                                <div className='angry-fellow-stat'>
                                    <span>Villains</span>
                                    <strong>{villainsLeft}</strong>
                                </div>
                            </div>
                            <div className='angry-fellow-actions'>
                                <button
                                    type='button'
                                    className='angry-fellow-secondary'
                                    onClick={handleReset}>
                                    Reset
                                </button>
                                <button
                                    type='button'
                                    className='angry-fellow-primary is-header'
                                    onClick={handleNewGame}>
                                    New Game
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className='angry-fellow-board-wrap'>
                    <div
                        className='angry-fellow-board'
                        ref={boardRef}
                        style={{
                            width: `${sceneWidth}px`,
                            height: `${sceneHeight}px`
                        }}>
                        <div className='angry-fellow-horizon' aria-hidden='true' />
                        <div className='angry-fellow-ground' aria-hidden='true' />
                        <div
                            className='angry-fellow-scene'
                            style={{
                                width: `${WORLD_WIDTH}px`,
                                height: `${WORLD_HEIGHT}px`,
                                transform: `scale(${scale})`
                            }}>
                            <div
                                className='angry-fellow-slingshot'
                                style={{
                                    left: `${WORLD_WIDTH * 0.2 - 22}px`,
                                    top: `${WORLD_HEIGHT - GROUND_HEIGHT - 150}px`
                                }}
                                aria-hidden='true'
                            />

                            {dragState ? (
                                <svg className='angry-fellow-band' viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}>
                                    <line
                                        x1={dragState.anchorX - 12}
                                        y1={dragState.anchorY - 20}
                                        x2={dragState.x}
                                        y2={dragState.y}
                                    />
                                    <line
                                        x1={dragState.anchorX + 12}
                                        y1={dragState.anchorY - 20}
                                        x2={dragState.x}
                                        y2={dragState.y}
                                    />
                                </svg>
                            ) : null}

                            <button
                                type='button'
                                ref={playerNodeRef}
                                className='angry-fellow-player'
                                onPointerDown={handlePlayerPointerDown}
                                disabled={status !== 'playing' || shotsLeft <= 0}
                                aria-label={`Launch ${player.label}`}>
                                {player.avatarSrc ? (
                                    <img
                                        src={player.avatarSrc}
                                        alt={player.label}
                                        className='angry-fellow-avatar'
                                        onError={(event) => {
                                            event.currentTarget.onerror = null
                                            event.currentTarget.src =
                                                player.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                        }}
                                    />
                                ) : (
                                    <span className='angry-fellow-fallback'>
                                        {player.displayLabel || player.id}
                                    </span>
                                )}
                            </button>

                            {renderBlocks.map(({ renderId, block }) => {
                                return (
                                    <div
                                        key={renderId}
                                        ref={(node) => registerBlockNode(renderId, node)}
                                        className={`angry-fellow-block is-${block.variant}`}
                                        style={{
                                            width: `${block.width}px`,
                                            height: `${block.height}px`
                                        }}
                                    />
                                )
                            })}

                            {roundConfig.villains.map((villain, index) => {
                                const renderId = `${villain.id}-${index}`
                                const isKilled = killedVillainIds.indexOf(renderId) !== -1

                                return (
                                    <div
                                        key={renderId}
                                        ref={(node) => registerVillainNode(renderId, node)}
                                        className={`angry-fellow-villain ${isKilled ? 'is-killed' : ''}`}>
                                        <div className='angry-fellow-villain-shell'>
                                            {villain.avatarSrc ? (
                                                <img
                                                    src={villain.avatarSrc}
                                                    alt={villain.label}
                                                    className='angry-fellow-avatar'
                                                    onError={(event) => {
                                                        event.currentTarget.onerror = null
                                                        event.currentTarget.src =
                                                            villain.avatarFallbackSrc ||
                                                            DEFAULT_FELLOW_AVATAR_SRC
                                                    }}
                                                />
                                            ) : (
                                                <span className='angry-fellow-fallback'>
                                                    {villain.displayLabel || villain.id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {status === 'won' || status === 'lost' ? (
                    <div className='angry-fellow-outcome'>
                        <h3>{status === 'won' ? 'Fort cleared' : 'Out of shots'}</h3>
                        <p>
                            {status === 'won'
                                ? `${player.label} flattened every villain.`
                                : `${villainsLeft} villain${villainsLeft === 1 ? '' : 's'} still standing.`}
                        </p>
                        <div className='angry-fellow-actions is-outcome'>
                            <button type='button' className='angry-fellow-secondary' onClick={handleReset}>
                                Reset
                            </button>
                            <button type='button' className='angry-fellow-primary' onClick={handleNewGame}>
                                New Game
                            </button>
                            <button type='button' className='angry-fellow-secondary' onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export default AngryFellowGameModal
