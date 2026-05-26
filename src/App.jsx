import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import ControlPanel from './components/ControlPanel'
import PingPongDrawMachine from './components/PingPongDrawMachine'
import { clampDrawCount, createMachineOption, parseOptions } from './utils/draw'

const DEFAULT_FELLOW_AVATAR_SRC = '/avatars/unknown.png'
const DROPPED_BALL_SIZE = 112
const DROPPED_BALL_RADIUS = DROPPED_BALL_SIZE / 2
const DROPPED_BALL_FLOOR_HEIGHT = 48
const DROP_SETTLE_SPEED = 0.14
const DROP_SETTLE_ANGULAR_SPEED = 0.02
const DROP_SETTLE_FRAMES = 18
const DROP_REPLACEMENT_TIMEOUT_MS = 5000
const DROP_SIDE_WALL_THICKNESS = 120
const DROP_OVERFLOW_THRESHOLD = 10
const DROP_OVERFLOW_INTERVAL_MS = 250
const DROP_SHOT_PREP_MS = 180
const DROP_SHOT_TRAVEL_MS = 260
const DROP_SHOT_COOLDOWN_MS = 220
const DROP_HIT_FADE_REMOVE_DELAY_MS = 400
const DROP_OUT_OF_VIEW_STOP_RATIO = 1 / 5
const DROP_OUT_OF_VIEW_RESUME_RATIO = 1 / 20
const DROP_OVERFLOW_CONTROL_MS = 220
const AVATAR_MOSAIC_BASE_COLUMNS = 32
const AVATAR_MOSAIC_ROW_DROP_MS = 1000
const GUN_WIDTH = 240
const GUN_RIGHT_OFFSET = 88
const GUN_BOTTOM_OFFSET = 20
const GUN_MUZZLE_OFFSET_X = 15
const GUN_MUZZLE_OFFSET_Y = 53
const GUN_BASE_AIM_DEGREES = -146

const PRESETS = {
    iceCream: [
        { id: 'banana', label: 'Banana' },
        { id: 'blueberry', label: 'Blueberry' },
        { id: 'caramel', label: 'Caramel' },
        { id: 'chocolate', label: 'Chocolate' },
        { id: 'coffee', label: 'Coffee' },
        { id: 'coconut', label: 'Coconut' },
        { id: 'cookies-cream', label: 'Cookies & Cream' },
        { id: 'black-pepper', label: 'Black Pepper' },
        { id: 'mango', label: 'Mango' },
        { id: 'milo', label: 'Milo' },
        { id: 'mint', label: 'Mint' },
        { id: 'matcha', label: 'Matcha' },
        { id: 'pistachio', label: 'Pistachio' },
        { id: 'rum-raisin', label: 'Rum Raisin' },
        { id: 'strawberry', label: 'Strawberry' },
        { id: 'taro', label: 'Taro' },
        { id: 'vanilla', label: 'Vanilla' }
    ],
    initials: [
        {
            id: 'AP',
            label: 'Asher Pakula',
            displayLabel: 'AP',
            avatarSrc: '/avatars/AP.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'DZ',
            label: 'Daniel Zelenko',
            displayLabel: 'DZ',
            avatarSrc: '/avatars/DZ.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'GF',
            label: 'Guoxiao Feng',
            displayLabel: 'GF',
            avatarSrc: '/avatars/GF.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'HK',
            label: 'Henry Kerr',
            displayLabel: 'HK',
            avatarSrc: '/avatars/HK.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'JH',
            label: 'Jay Hamilton',
            displayLabel: 'JH',
            avatarSrc: '/avatars/JH.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'JB',
            label: 'Josh Boul',
            displayLabel: 'JB',
            avatarSrc: '/avatars/JB.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'MM',
            label: 'Mayank Mongia',
            displayLabel: 'MM',
            avatarSrc: '/avatars/MM.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'MI',
            label: 'Moin Iqbal',
            displayLabel: 'MI',
            avatarSrc: '/avatars/MI.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SG',
            label: 'Shelly Giddens',
            displayLabel: 'SG',
            avatarSrc: '/avatars/SG.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SN',
            label: 'Steven Nocker',
            displayLabel: 'SN',
            avatarSrc: '/avatars/SN.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SW',
            label: 'Steve Whatman',
            displayLabel: 'SW',
            avatarSrc: '/avatars/SW.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        }
    ]
}
const EMPTY_PRESET_OPTIONS = []

function getPresetOptionIds(presetOptions) {
    return presetOptions.map((option) => option.id)
}

function getPresetOptionMap(presetOptions) {
    const optionMap = {}
    presetOptions.forEach((option) => {
        optionMap[option.id] = option
    })
    return optionMap
}

function getPresetOptionLabelMap(presetOptions) {
    const optionMap = {}
    presetOptions.forEach((option) => {
        optionMap[option.label] = option
    })
    return optionMap
}

function shuffleList(items) {
    const result = [...items]
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
    }
    return result
}

function App() {
    const [presetKey, setPresetKey] = useState('initials')
    const [optionsText, setOptionsText] = useState(
        PRESETS.initials.map((option) => option.label).join('\n')
    )
    const [selectedPresetOptions, setSelectedPresetOptions] = useState(
        getPresetOptionIds(PRESETS.initials)
    )
    const [drawCount, setDrawCount] = useState(3)
    const [status, setStatus] = useState('Ready')
    const [results, setResults] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [runSeed, setRunSeed] = useState(0)
    const [resetToken, setResetToken] = useState(0)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false)
    const [rainEffect, setRainEffect] = useState('avatarMosaicBuild')
    const [droppedBalls, setDroppedBalls] = useState([])
    const [droppedResultReplacements, setDroppedResultReplacements] = useState({})
    const [lastToggledOnFellowId, setLastToggledOnFellowId] = useState('MM')
    const [activeShot, setActiveShot] = useState(null)
    const [avatarMosaic, setAvatarMosaic] = useState(null)
    const droppedBodiesRef = useRef(new Map())
    const droppedNodesRef = useRef(new Map())
    const droppedBallMetaRef = useRef(new Map())
    const dropRevealTimeoutsRef = useRef(new Map())
    const dropOverflowIntervalsRef = useRef(new Map())
    const droppedBallCountsRef = useRef(new Map())
    const overflowSourceMapRef = useRef(new Map())
    const overflowControllerRef = useRef(0)
    const activeShotTimeoutRef = useRef(0)
    const activeRemoveTimeoutRef = useRef(0)
    const mosaicBuildTokenRef = useRef(0)
    const physicsRef = useRef(null)
    const animationFrameRef = useRef(0)
    const droppedBallIdRef = useRef(0)

    const presetOptions = PRESETS[presetKey] || EMPTY_PRESET_OPTIONS
    const presetOptionMap = useMemo(() => getPresetOptionMap(presetOptions), [presetOptions])
    const fellowIdMap = useMemo(() => getPresetOptionMap(PRESETS.initials), [])
    const fellowLabelMap = useMemo(() => getPresetOptionLabelMap(PRESETS.initials), [])
    const parsedOptions = useMemo(() => {
        if (presetKey === 'custom') {
            return parseOptions(optionsText)
        }

        return selectedPresetOptions
            .map((optionId) => presetOptionMap[optionId])
            .filter(Boolean)
            .map((option, index) => createMachineOption(option, index))
    }, [optionsText, presetKey, presetOptionMap, selectedPresetOptions])
    const fellowResults = useMemo(
        () =>
            results
                .map((result) => fellowLabelMap[result])
                .filter(Boolean),
        [fellowLabelMap, results]
    )
    const defaultReplacementFellow = fellowIdMap.MM || PRESETS.initials.find((option) => option.id === 'MM')
    const shouldShowFellowResults = presetKey === 'initials' && fellowResults.length === results.length
    const isGunshotCleanupEnabled = rainEffect === 'gunshotCleanup'
    const isAvatarMosaicEnabled = rainEffect === 'avatarMosaicBuild'
    const optionCount = parsedOptions.length
    const safeDrawCount = clampDrawCount(drawCount, optionCount)

    const validationMessage = useMemo(() => {
        if (optionCount === 0) {
            return 'Please enter at least one option.'
        }
        if (Number.isNaN(Number(drawCount)) || Number(drawCount) < 1) {
            return 'Draw count must be at least 1.'
        }
        if (Number(drawCount) > optionCount) {
            return 'Draw count cannot exceed option count.'
        }
        return ''
    }, [drawCount, optionCount])

    const canStart = !isDrawing && !validationMessage && optionCount > 0

    useEffect(() => {
        const { Engine, Runner, Bodies, Composite } = Matter
        const engine = Engine.create({
            gravity: { x: 0, y: 0.9 }
        })
        const runner = Runner.create()
        const floor = Bodies.rectangle(
            window.innerWidth / 2,
            window.innerHeight + DROPPED_BALL_FLOOR_HEIGHT / 2,
            Math.max(window.innerWidth * 3, 4000),
            DROPPED_BALL_FLOOR_HEIGHT,
            {
                isStatic: true
            }
        )
        const leftWall = Bodies.rectangle(
            -DROP_SIDE_WALL_THICKNESS / 2,
            window.innerHeight / 2,
            DROP_SIDE_WALL_THICKNESS,
            window.innerHeight * 3,
            {
                isStatic: true
            }
        )
        const rightWall = Bodies.rectangle(
            window.innerWidth + DROP_SIDE_WALL_THICKNESS / 2,
            window.innerHeight / 2,
            DROP_SIDE_WALL_THICKNESS,
            window.innerHeight * 3,
            {
                isStatic: true
            }
        )

        Composite.add(engine.world, [floor, leftWall, rightWall])
        Runner.run(runner, engine)

        physicsRef.current = { engine, runner, floor, leftWall, rightWall }

        const syncFloor = () => {
            if (!physicsRef.current) {
                return
            }

            Matter.Body.setPosition(physicsRef.current.floor, {
                x: window.innerWidth / 2,
                y: window.innerHeight + DROPPED_BALL_FLOOR_HEIGHT / 2
            })
            Matter.Body.setPosition(physicsRef.current.leftWall, {
                x: -DROP_SIDE_WALL_THICKNESS / 2,
                y: window.innerHeight / 2
            })
            Matter.Body.setPosition(physicsRef.current.rightWall, {
                x: window.innerWidth + DROP_SIDE_WALL_THICKNESS / 2,
                y: window.innerHeight / 2
            })
        }

        const renderDroppedBalls = () => {
            droppedBodiesRef.current.forEach((body, id) => {
                const node = droppedNodesRef.current.get(id)
                if (!node) {
                    return
                }

                const meta = droppedBallMetaRef.current.get(id)
                if (meta && !meta.hasSettled) {
                    const isOnGround =
                        body.position.y >=
                        window.innerHeight - DROPPED_BALL_RADIUS - DROP_SETTLE_SPEED * 10
                    const isSlowEnough =
                        Math.abs(body.velocity.x) < DROP_SETTLE_SPEED &&
                        Math.abs(body.velocity.y) < DROP_SETTLE_SPEED &&
                        Math.abs(body.angularVelocity) < DROP_SETTLE_ANGULAR_SPEED

                    if (isOnGround && isSlowEnough) {
                        meta.stillFrames += 1
                        if (meta.stillFrames >= DROP_SETTLE_FRAMES) {
                            meta.hasSettled = true
                            revealDroppedReplacement(meta.resultKey)
                        }
                    } else {
                        meta.stillFrames = 0
                    }
                }

                node.style.transform = `translate(${body.position.x - DROPPED_BALL_RADIUS}px, ${
                    body.position.y - DROPPED_BALL_RADIUS
                }px) rotate(${body.angle}rad)`
            })

            animationFrameRef.current = window.requestAnimationFrame(renderDroppedBalls)
        }

        animationFrameRef.current = window.requestAnimationFrame(renderDroppedBalls)
        window.addEventListener('resize', syncFloor)

        return () => {
            window.removeEventListener('resize', syncFloor)
            window.cancelAnimationFrame(animationFrameRef.current)
            Runner.stop(runner)
            Matter.World.clear(engine.world, false)
            Matter.Engine.clear(engine)
            physicsRef.current = null
            droppedBodiesRef.current.clear()
            droppedNodesRef.current.clear()
            droppedBallMetaRef.current.clear()
            dropRevealTimeoutsRef.current.clear()
            dropOverflowIntervalsRef.current.clear()
            droppedBallCountsRef.current.clear()
            overflowSourceMapRef.current.clear()
            window.clearInterval(overflowControllerRef.current)
            overflowControllerRef.current = 0
        }
    }, [])

    useEffect(() => {
        if (isResultsModalOpen) {
            return
        }

        clearDroppedBalls()
    }, [isResultsModalOpen])

    const handleOptionsChange = (value) => {
        setOptionsText(value)

        const nextCount = parseOptions(value).length
        setDrawCount((current) => clampDrawCount(current, nextCount))
    }

    const handleDrawCountChange = (value) => {
        if (value === '') {
            setDrawCount('')
            return
        }

        setDrawCount(Number(value))
    }

    const handlePresetChange = (nextPresetKey) => {
        setPresetKey(nextPresetKey)
        if (nextPresetKey !== 'custom') {
            const nextPresetOptions = PRESETS[nextPresetKey]
            const nextSelectedIds = getPresetOptionIds(nextPresetOptions)
            const presetText = nextPresetOptions.map((option) => option.label).join('\n')
            setSelectedPresetOptions(nextSelectedIds)
            setOptionsText(presetText)
            setDrawCount((current) => clampDrawCount(current, nextPresetOptions.length))
        }
    }

    const handlePresetOptionToggle = (optionId) => {
        setSelectedPresetOptions((current) => {
            const isAlreadySelected = current.indexOf(optionId) !== -1
            const nextSelection =
                isAlreadySelected
                    ? current.filter((item) => item !== optionId)
                    : getPresetOptionIds(presetOptions).filter(
                          (presetOptionId) =>
                              presetOptionId === optionId || current.indexOf(presetOptionId) !== -1
                      )

            if (!isAlreadySelected && fellowLabelMap[presetOptionMap[optionId]?.label]) {
                setLastToggledOnFellowId(optionId)
            }

            setOptionsText(
                nextSelection
                    .map((selectedId) => presetOptionMap[selectedId])
                    .filter(Boolean)
                    .map((option) => option.label)
                    .join('\n')
            )
            setDrawCount((drawValue) => clampDrawCount(drawValue, nextSelection.length))
            return nextSelection
        })
    }

    const handleStart = () => {
        if (!canStart) {
            return
        }

        clearDroppedBalls()
        setResults([])
        setIsDrawing(true)
        setStatus('Mixing balls...')
        setRunSeed((current) => current + 1)
        setIsDrawerOpen(false)
        setIsResultsModalOpen(false)
    }

    const handleReset = () => {
        clearDroppedBalls()
        setIsDrawing(false)
        setResults([])
        setStatus('Ready')
        setResetToken((current) => current + 1)
        setIsResultsModalOpen(false)
    }

    const clearDroppedBalls = () => {
        if (physicsRef.current) {
            droppedBodiesRef.current.forEach((body) => {
                Matter.Composite.remove(physicsRef.current.engine.world, body)
            })
        }

        dropRevealTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId)
        })
        dropOverflowIntervalsRef.current.forEach((intervalId) => {
            window.clearInterval(intervalId)
        })
        window.clearInterval(overflowControllerRef.current)
        window.clearTimeout(activeShotTimeoutRef.current)
        window.clearTimeout(activeRemoveTimeoutRef.current)

        droppedBodiesRef.current.clear()
        droppedNodesRef.current.clear()
        droppedBallMetaRef.current.clear()
        dropRevealTimeoutsRef.current.clear()
        dropOverflowIntervalsRef.current.clear()
        droppedBallCountsRef.current.clear()
        overflowSourceMapRef.current.clear()
        overflowControllerRef.current = 0
        activeShotTimeoutRef.current = 0
        activeRemoveTimeoutRef.current = 0
        setActiveShot(null)
        setAvatarMosaic(null)
        setDroppedBalls([])
        setDroppedResultReplacements({})
    }

    const registerDroppedBallNode = (id, node) => {
        if (!node) {
            droppedNodesRef.current.delete(id)
            return
        }

        droppedNodesRef.current.set(id, node)
    }

    const revealDroppedReplacement = (resultKey) => {
        const timeoutId = dropRevealTimeoutsRef.current.get(resultKey)
        if (timeoutId) {
            window.clearTimeout(timeoutId)
            dropRevealTimeoutsRef.current.delete(resultKey)
        }

        setDroppedResultReplacements((current) => {
            const next = current[resultKey]
            if (!next || next.isVisible) {
                return current
            }

            return {
                ...current,
                [resultKey]: {
                    ...next,
                    isVisible: true
                }
            }
        })
    }

    const getOutOfViewBallCount = () => {
        let count = 0
        droppedBodiesRef.current.forEach((body) => {
            const isOutsideViewport =
                body.position.x < -DROPPED_BALL_RADIUS ||
                body.position.x > window.innerWidth + DROPPED_BALL_RADIUS ||
                body.position.y < -DROPPED_BALL_RADIUS ||
                body.position.y > window.innerHeight + DROPPED_BALL_RADIUS

            if (isOutsideViewport) {
                count += 1
            }
        })
        return count
    }

    const shouldStopOverflowRain = () => {
        const totalCount = droppedBodiesRef.current.size
        if (!totalCount) {
            return false
        }

        return getOutOfViewBallCount() / totalCount >= DROP_OUT_OF_VIEW_STOP_RATIO
    }

    const shouldResumeOverflowRain = () => {
        const totalCount = droppedBodiesRef.current.size
        if (!totalCount) {
            return true
        }

        return getOutOfViewBallCount() / totalCount <= DROP_OUT_OF_VIEW_RESUME_RATIO
    }

    const stopAllOverflowRain = () => {
        dropOverflowIntervalsRef.current.forEach((intervalId) => {
            window.clearInterval(intervalId)
        })
        dropOverflowIntervalsRef.current.clear()
    }

    const removeDroppedBall = (ballId) => {
        const latestBody = droppedBodiesRef.current.get(ballId)
        if (latestBody && physicsRef.current) {
            Matter.Composite.remove(physicsRef.current.engine.world, latestBody)
        }

        droppedBodiesRef.current.delete(ballId)
        droppedNodesRef.current.delete(ballId)
        droppedBallMetaRef.current.delete(ballId)
        setDroppedBalls((current) => current.filter((item) => item.id !== ballId))
    }

    const loadImage = (src, fallbackSrc) =>
        new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => {
                if (fallbackSrc && fallbackSrc !== src) {
                    const fallbackImage = new Image()
                    fallbackImage.onload = () => resolve(fallbackImage)
                    fallbackImage.onerror = reject
                    fallbackImage.src = fallbackSrc
                    return
                }

                reject(new Error(`Failed to load image: ${src}`))
            }
            image.src = src
        })

    const buildAvatarMosaic = async (result) => {
        if (!result.avatarSrc) {
            return
        }

        const buildToken = mosaicBuildTokenRef.current + 1
        mosaicBuildTokenRef.current = buildToken

        try {
            const image = await loadImage(
                result.avatarSrc,
                result.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
            )
            if (buildToken !== mosaicBuildTokenRef.current) {
                return
            }

            const isLandscape = window.innerWidth >= window.innerHeight
            const columns = isLandscape
                ? Math.max(
                      AVATAR_MOSAIC_BASE_COLUMNS,
                      Math.round((window.innerWidth / window.innerHeight) * 24)
                  )
                : AVATAR_MOSAIC_BASE_COLUMNS
            const rows = Math.max(
                18,
                Math.round((image.naturalHeight / image.naturalWidth) * columns)
            )
            const canvas = document.createElement('canvas')
            canvas.width = columns
            canvas.height = rows
            const context = canvas.getContext('2d', { willReadFrequently: true })

            if (!context) {
                return
            }

            context.drawImage(image, 0, 0, columns, rows)
            const { data } = context.getImageData(0, 0, columns, rows)
            const sourceAspectRatio = columns / rows
            const viewportAspectRatio = window.innerWidth / window.innerHeight
            const mosaicWidth = isLandscape
                ? Math.round(window.innerHeight * sourceAspectRatio)
                : window.innerWidth
            const mosaicHeight = isLandscape
                ? window.innerHeight
                : Math.round(window.innerWidth / sourceAspectRatio)
            const cellWidth = mosaicWidth / columns
            const cellHeight = mosaicHeight / rows
            const tiles = []
            for (let row = 0; row < rows; row += 1) {
                const rowColumns = shuffleList(Array.from({ length: columns }, (_, col) => col))
                const rowStepMs = AVATAR_MOSAIC_ROW_DROP_MS / Math.max(1, rowColumns.length)

                rowColumns.forEach((col, orderIndex) => {
                    const pixelIndex = (row * columns + col) * 4
                    const red = data[pixelIndex]
                    const green = data[pixelIndex + 1]
                    const blue = data[pixelIndex + 2]
                    const alpha = data[pixelIndex + 3] / 255

                    tiles.push({
                        id: `${result.id}-${row}-${col}`,
                        row,
                        col,
                        color: `rgba(${red}, ${green}, ${blue}, ${Math.max(0.3, alpha)})`,
                        delay: Math.round(row * AVATAR_MOSAIC_ROW_DROP_MS + orderIndex * rowStepMs),
                        driftX: `${(col % 2 === 0 ? -1 : 1) * (18 + (row % 3) * 8)}px`,
                        driftY: `${-mosaicHeight - 80 - row * 10}px`
                    })
                })
            }

            setAvatarMosaic({
                personKey: result.id || result.label,
                label: result.label,
                avatarSrc: result.avatarSrc,
                avatarFallbackSrc: result.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC,
                width: mosaicWidth,
                height: mosaicHeight,
                cellWidth,
                cellHeight,
                columns,
                rows,
                tiles
            })
        } catch {
            setAvatarMosaic(null)
        }
    }

    const handleDroppedBallShot = (ballId) => {
        const ball = droppedBalls.find((item) => item.id === ballId)
        const body = droppedBodiesRef.current.get(ballId)
        const node = droppedNodesRef.current.get(ballId)
        if (!ball || !body || !node || ball.isExploding) {
            return
        }

        const bounds = node.getBoundingClientRect()
        const targetX = bounds.left + bounds.width / 2
        const targetY = bounds.top + bounds.height / 2
        const startX = window.innerWidth - GUN_RIGHT_OFFSET - GUN_WIDTH + GUN_MUZZLE_OFFSET_X
        const startY = window.innerHeight - GUN_BOTTOM_OFFSET - GUN_MUZZLE_OFFSET_Y
        const aimAngle =
            (Math.atan2(targetY - startY, targetX - startX) * 180) / Math.PI -
            GUN_BASE_AIM_DEGREES

        setActiveShot({
            ballId,
            startX,
            startY,
            endX: targetX,
            endY: targetY,
            aimAngle,
            isBulletVisible: false
        })

        Matter.Body.setStatic(body, true)
        Matter.Body.setVelocity(body, { x: 0, y: 0 })
        Matter.Body.setAngularVelocity(body, 0)

        window.clearTimeout(activeShotTimeoutRef.current)
        window.clearTimeout(activeRemoveTimeoutRef.current)

        activeShotTimeoutRef.current = window.setTimeout(() => {
            setActiveShot((current) =>
                current?.ballId === ballId ? { ...current, isBulletVisible: true } : current
            )

            activeRemoveTimeoutRef.current = window.setTimeout(() => {
                setDroppedBalls((current) =>
                    current.map((item) => (item.id === ballId ? { ...item, isExploding: true } : item))
                )
                setActiveShot((current) =>
                    current?.ballId === ballId ? { ...current, isBulletVisible: false } : current
                )

                window.setTimeout(() => {
                    setActiveShot((current) => (current?.ballId === ballId ? null : current))
                }, DROP_SHOT_COOLDOWN_MS)

                window.setTimeout(() => {
                    removeDroppedBall(ballId)
                }, DROP_HIT_FADE_REMOVE_DELAY_MS)
            }, DROP_SHOT_TRAVEL_MS)
        }, DROP_SHOT_PREP_MS)
    }

    const spawnDroppedBall = (result, resultKey, positionOverride) => {
        if (!physicsRef.current) {
            return
        }

        const dropId = `dropped-ball-${droppedBallIdRef.current + 1}`
        droppedBallIdRef.current += 1
        const startX = positionOverride?.x ?? window.innerWidth / 2
        const startY = positionOverride?.y ?? DROPPED_BALL_RADIUS
        const body = Matter.Bodies.circle(startX, startY, DROPPED_BALL_RADIUS, {
            restitution: 0.82,
            friction: 0.02,
            frictionAir: 0.014,
            density: 0.0015
        })

        droppedBodiesRef.current.set(dropId, body)
        droppedBallMetaRef.current.set(dropId, {
            resultKey,
            hasSettled: false,
            stillFrames: 0
        })
        Matter.Composite.add(physicsRef.current.engine.world, body)
        setDroppedBalls((current) => [
            ...current,
            {
                id: dropId,
                label: result.label,
                displayLabel: result.displayLabel || result.id,
                avatarSrc: result.avatarSrc || null,
                avatarFallbackSrc: result.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC,
                isExploding: false
            }
        ])
    }

    const ensureOverflowDropper = (result) => {
        const personKey = result.id || result.label
        const currentCount = droppedBallCountsRef.current.get(personKey) || 0
        overflowSourceMapRef.current.set(personKey, result)
        if (currentCount <= DROP_OVERFLOW_THRESHOLD) {
            return
        }

        if (isAvatarMosaicEnabled) {
            if (avatarMosaic?.personKey !== personKey) {
                buildAvatarMosaic(result)
            }
            return
        }

        if (dropOverflowIntervalsRef.current.has(personKey)) {
            return
        }

        const intervalId = window.setInterval(() => {
            if (shouldStopOverflowRain()) {
                window.clearInterval(intervalId)
                dropOverflowIntervalsRef.current.delete(personKey)
                return
            }

            const maxX = window.innerWidth - DROPPED_BALL_RADIUS
            const minX = DROPPED_BALL_RADIUS
            const randomX = minX + Math.random() * Math.max(1, maxX - minX)
            spawnDroppedBall(result, `overflow-${personKey}`, {
                x: randomX,
                y: -DROPPED_BALL_RADIUS
            })
            droppedBallCountsRef.current.set(
                personKey,
                (droppedBallCountsRef.current.get(personKey) || 0) + 1
            )
        }, DROP_OVERFLOW_INTERVAL_MS)

        dropOverflowIntervalsRef.current.set(personKey, intervalId)
    }

    const ensureOverflowController = () => {
        if (isAvatarMosaicEnabled) {
            return
        }

        if (overflowControllerRef.current) {
            return
        }

        overflowControllerRef.current = window.setInterval(() => {
            if (shouldStopOverflowRain()) {
                stopAllOverflowRain()
                return
            }

            if (!shouldResumeOverflowRain()) {
                return
            }

            overflowSourceMapRef.current.forEach((result, personKey) => {
                if ((droppedBallCountsRef.current.get(personKey) || 0) <= DROP_OVERFLOW_THRESHOLD) {
                    return
                }

                ensureOverflowDropper(result)
            })
        }, DROP_OVERFLOW_CONTROL_MS)
    }

    const handleDropResultBall = (result, resultKey) => {
        if (!physicsRef.current) {
            return
        }

        const triggerNode = document.getElementById(resultKey)
        const bounds = triggerNode?.getBoundingClientRect()

        if (!bounds) {
            return
        }

        const startX = bounds.left + bounds.width / 2
        const startY = bounds.top + bounds.height / 2
        spawnDroppedBall(result, resultKey, { x: startX, y: startY })
        const personKey = result.id || result.label
        droppedBallCountsRef.current.set(personKey, (droppedBallCountsRef.current.get(personKey) || 0) + 1)
        ensureOverflowController()
        ensureOverflowDropper(result)
        setDroppedResultReplacements((current) => ({
            ...current,
            [resultKey]: {
                fellow: fellowIdMap[lastToggledOnFellowId] || defaultReplacementFellow || result,
                isVisible: false
            }
        }))
        const revealTimeoutId = window.setTimeout(() => {
            revealDroppedReplacement(resultKey)
        }, DROP_REPLACEMENT_TIMEOUT_MS)
        dropRevealTimeoutsRef.current.set(resultKey, revealTimeoutId)
    }

    return (
        <main className='app-shell'>
            <button
                type='button'
                className='drawer-toggle'
                onClick={() => setIsDrawerOpen((current) => !current)}
                aria-expanded={isDrawerOpen}
                aria-controls='controls-drawer'>
                {isDrawerOpen ? 'Close Controls' : 'Open Controls'}
            </button>

            <div
                className={`drawer-scrim ${isDrawerOpen ? 'is-open' : ''}`}
                onClick={() => setIsDrawerOpen(false)}
                aria-hidden={!isDrawerOpen}
            />

            <aside
                id='controls-drawer'
                className={`controls-drawer ${isDrawerOpen ? 'is-open' : ''}`}>
                <ControlPanel
                    presetKey={presetKey}
                    optionsText={optionsText}
                    presetOptions={presetOptions}
                    selectedPresetOptions={selectedPresetOptions}
                    drawCount={drawCount}
                    maxDrawCount={optionCount}
                    rainEffect={rainEffect}
                    validationMessage={validationMessage}
                    isDrawing={isDrawing}
                    onPresetChange={handlePresetChange}
                    onPresetOptionToggle={handlePresetOptionToggle}
                    onOptionsChange={handleOptionsChange}
                    onDrawCountChange={handleDrawCountChange}
                    onRainEffectChange={setRainEffect}
                    onReset={handleReset}
                />
            </aside>

            <section className='content-grid'>
                <div className='machine-column'>
                    <PingPongDrawMachine
                        options={parsedOptions}
                        drawCount={safeDrawCount}
                        runSeed={runSeed}
                        resetToken={resetToken}
                        isDrawing={isDrawing}
                        onStatusChange={setStatus}
                        onResultsChange={setResults}
                        onDrawComplete={() => {
                            setIsDrawing(false)
                            setIsResultsModalOpen(true)
                        }}
                    />
                    <button
                        type='button'
                        className='machine-draw-button'
                        onClick={handleStart}
                        disabled={!canStart}>
                        Start Draw
                    </button>
                </div>
            </section>

            {isResultsModalOpen ? (
                <div
                    className='results-modal-backdrop'
                    onClick={() => setIsResultsModalOpen(false)}>
                    <section
                        className='results-modal panel'
                        onClick={(event) => event.stopPropagation()}>
                        <div className='results-modal-header'>
                            <div>
                                <h2>Results</h2>
                                <p>{status}</p>
                            </div>
                            <button
                                type='button'
                                className='results-modal-close'
                                onClick={() => setIsResultsModalOpen(false)}>
                                Close
                            </button>
                        </div>

                        {shouldShowFellowResults ? (
                            <ol className='fellow-results-row'>
                                {fellowResults.map((result, index) => {
                                    const resultKey = `fellow-result-ball-${result.id}-${index}`
                                    const replacement = droppedResultReplacements[resultKey]
                                    const displayedResult = replacement?.fellow || result
                                    const isReplacementPending = Boolean(replacement && !replacement.isVisible)
                                    const isReplacementVisible = Boolean(replacement?.isVisible)

                                    return (
                                        <li key={`${result.id}-${index}`} className='fellow-result-card'>
                                            <div className='fellow-result-rank'>{index + 1}</div>
                                            <button
                                                type='button'
                                                id={resultKey}
                                                className={`fellow-result-ball ${
                                                    isReplacementPending ? 'is-waiting-replacement' : ''
                                                }`}
                                                onClick={() =>
                                                    handleDropResultBall(displayedResult, resultKey)
                                                }
                                                disabled={isReplacementPending}
                                                aria-label={`Drop ${displayedResult.label} ball`}>
                                                {displayedResult.avatarSrc ? (
                                                    <img
                                                        src={displayedResult.avatarSrc}
                                                        alt={displayedResult.label}
                                                        className={`fellow-result-avatar ${
                                                            isReplacementVisible
                                                                ? 'is-replacement-visible'
                                                                : ''
                                                        }`}
                                                        onError={(event) => {
                                                            event.currentTarget.onerror = null
                                                            event.currentTarget.src =
                                                                displayedResult.avatarFallbackSrc ||
                                                                DEFAULT_FELLOW_AVATAR_SRC
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`fellow-result-initials ${
                                                            isReplacementVisible
                                                                ? 'is-replacement-visible'
                                                                : ''
                                                        }`}>
                                                        {displayedResult.displayLabel ||
                                                            displayedResult.id}
                                                    </span>
                                                )}
                                            </button>
                                            <div
                                                className={`fellow-result-name ${
                                                    isReplacementPending
                                                        ? 'is-waiting-replacement'
                                                        : ''
                                                } ${
                                                    isReplacementVisible
                                                        ? 'is-replacement-visible'
                                                        : ''
                                                }`}>
                                                {displayedResult.label}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        ) : (
                            <ol className='results-list'>
                                {results.map((result, index) => (
                                    <li key={`${result}-${index}`} className='result-item'>
                                        <span className='result-order'>{index + 1}</span>
                                        <span className='result-value'>{result}</span>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {!results.length ? (
                            <div className='results-empty'>No balls reached the rail yet.</div>
                        ) : null}
                    </section>
                </div>
            ) : null}
            <div className='dropped-balls-layer' aria-hidden='true'>
                {droppedBalls.map((ball) => (
                    <button
                        key={ball.id}
                        ref={(node) => registerDroppedBallNode(ball.id, node)}
                        type='button'
                        className={`dropped-result-ball ${ball.isExploding ? 'is-exploding' : ''}`}
                        onClick={() => {
                            if (isGunshotCleanupEnabled) {
                                handleDroppedBallShot(ball.id)
                            }
                        }}
                        disabled={!isGunshotCleanupEnabled || ball.isExploding}
                        aria-label={`Shoot ${ball.label} dropped avatar`}>
                        {ball.avatarSrc ? (
                            <img
                                src={ball.avatarSrc}
                                alt=''
                                className='fellow-result-avatar'
                                onError={(event) => {
                                    event.currentTarget.onerror = null
                                    event.currentTarget.src =
                                        ball.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                }}
                            />
                        ) : (
                            <span className='fellow-result-initials'>{ball.displayLabel}</span>
                        )}
                    </button>
                ))}
            </div>
            {avatarMosaic && isAvatarMosaicEnabled ? (
                <div className='avatar-mosaic-overlay' aria-hidden='true'>
                    <div
                        className='avatar-mosaic-board'
                        style={{
                            width: `${avatarMosaic.width}px`,
                            height: `${avatarMosaic.height}px`,
                        }}>
                        {avatarMosaic.tiles.map((tile) => (
                            <div
                                key={tile.id}
                                className='avatar-mosaic-tile'
                                style={{
                                    left: `${tile.col * avatarMosaic.cellWidth}px`,
                                    top: `${tile.row * avatarMosaic.cellHeight}px`,
                                    width: `${avatarMosaic.cellWidth}px`,
                                    height: `${avatarMosaic.cellHeight}px`,
                                    '--avatar-mosaic-delay': `${tile.delay}ms`,
                                    '--avatar-mosaic-drift-x': tile.driftX,
                                    '--avatar-mosaic-drift-y': tile.driftY,
                                    '--avatar-mosaic-tint': tile.color,
                                    '--avatar-mosaic-image': `url(${avatarMosaic.avatarSrc})`
                                }}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
            {activeShot && isGunshotCleanupEnabled ? (
                <div className='shot-overlay' aria-hidden='true'>
                    <img
                        src='/gun.png'
                        alt=''
                        className='shot-gun'
                        style={{ '--gun-aim-rotate': `${activeShot.aimAngle}deg` }}
                    />
                    {activeShot.isBulletVisible ? (
                        <div
                            className='shot-bullet'
                            style={{
                                '--shot-start-x': `${activeShot.startX}px`,
                                '--shot-start-y': `${activeShot.startY}px`,
                                '--shot-end-x': `${activeShot.endX}px`,
                                '--shot-end-y': `${activeShot.endY}px`
                            }}
                        />
                    ) : null}
                </div>
            ) : null}
        </main>
    )
}

export default App
