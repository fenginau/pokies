import { useEffect, useRef, useState } from 'react'
import { DEFAULT_FELLOW_AVATAR_SRC } from '../constants/assets'

const BOARD_ROWS = 8
const BOARD_COLS = 8
const TARGET_SCORE = 5000
const MAX_MOVES = 18
const ROUND_TIME_SECONDS = 90
const TILE_SIZE = 56
const SWAP_ANIMATION_MS = 240
const FALL_ANIMATION_MS = 320
const REMOVE_ANIMATION_MS = 220
const HINT_DURATION_MS = 1500
const MAX_RESOLVE_STEPS = 40
const SHAPE_CLASSES = [
    'is-circle',
    'is-rounded-square',
    'is-diamond',
    'is-triangle',
    'is-hexagon',
    'is-octagon',
    'is-star',
    'is-pill'
]

function wait(duration) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, duration)
    })
}

function nextFrame() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(resolve)
        })
    })
}

function randomTypeIndex(typeCount) {
    return Math.floor(Math.random() * typeCount)
}

function isAdjacent(first, second) {
    return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1
}

function cloneTypeMatrix(matrix) {
    return matrix.map((row) => row.slice())
}

function createTileTypeMap(tileTypes) {
    return tileTypes.map((tileType, index) => ({
        typeIndex: index,
        id: tileType.id,
        label: tileType.label,
        displayLabel: tileType.displayLabel || tileType.id,
        avatarSrc: tileType.avatarSrc || DEFAULT_FELLOW_AVATAR_SRC,
        avatarFallbackSrc: tileType.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC,
        shapeClass: SHAPE_CLASSES[index % SHAPE_CLASSES.length]
    }))
}

function calculateMatchScore(length) {
    if (length <= 3) {
        return 100
    }
    if (length === 4) {
        return 200
    }
    if (length === 5) {
        return 400
    }
    return 400 + (length - 5) * 100
}

function findMatchGroupsInTypeMatrix(matrix) {
    const groups = []
    let row = 0
    let col = 0

    for (row = 0; row < BOARD_ROWS; row += 1) {
        col = 0
        while (col < BOARD_COLS) {
            const typeIndex = matrix[row][col]
            let endCol = col + 1

            if (typeIndex === null) {
                col += 1
                continue
            }

            while (endCol < BOARD_COLS && matrix[row][endCol] === typeIndex) {
                endCol += 1
            }

            if (endCol - col >= 3) {
                groups.push({
                    direction: 'row',
                    typeIndex,
                    cells: Array.from({ length: endCol - col }, (_, offset) => ({
                        row,
                        col: col + offset
                    }))
                })
            }

            col = endCol
        }
    }

    for (col = 0; col < BOARD_COLS; col += 1) {
        row = 0
        while (row < BOARD_ROWS) {
            const typeIndex = matrix[row][col]
            let endRow = row + 1

            if (typeIndex === null) {
                row += 1
                continue
            }

            while (endRow < BOARD_ROWS && matrix[endRow][col] === typeIndex) {
                endRow += 1
            }

            if (endRow - row >= 3) {
                groups.push({
                    direction: 'col',
                    typeIndex,
                    cells: Array.from({ length: endRow - row }, (_, offset) => ({
                        row: row + offset,
                        col
                    }))
                })
            }

            row = endRow
        }
    }

    return groups
}

function findFirstPossibleMove(matrix) {
    const workingMatrix = cloneTypeMatrix(matrix)

    for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let col = 0; col < BOARD_COLS; col += 1) {
            const candidates = [
                { row, col: col + 1 },
                { row: row + 1, col }
            ]

            for (let index = 0; index < candidates.length; index += 1) {
                const candidate = candidates[index]
                if (candidate.row >= BOARD_ROWS || candidate.col >= BOARD_COLS) {
                    continue
                }

                const current = workingMatrix[row][col]
                workingMatrix[row][col] = workingMatrix[candidate.row][candidate.col]
                workingMatrix[candidate.row][candidate.col] = current

                if (findMatchGroupsInTypeMatrix(workingMatrix).length > 0) {
                    workingMatrix[candidate.row][candidate.col] = workingMatrix[row][col]
                    workingMatrix[row][col] = current
                    return [
                        { row, col },
                        { row: candidate.row, col: candidate.col }
                    ]
                }

                workingMatrix[candidate.row][candidate.col] = workingMatrix[row][col]
                workingMatrix[row][col] = current
            }
        }
    }

    return null
}

function createInitialTypeMatrix(typeCount) {
    let attempt = 0

    while (attempt < 80) {
        const matrix = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null))

        // Fill left-to-right while refusing placements that would create a starting match.
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                const allowedTypes = []

                for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
                    const createsHorizontalMatch =
                        col >= 2 &&
                        matrix[row][col - 1] === typeIndex &&
                        matrix[row][col - 2] === typeIndex
                    const createsVerticalMatch =
                        row >= 2 &&
                        matrix[row - 1][col] === typeIndex &&
                        matrix[row - 2][col] === typeIndex

                    if (!createsHorizontalMatch && !createsVerticalMatch) {
                        allowedTypes.push(typeIndex)
                    }
                }

                matrix[row][col] = allowedTypes.length
                    ? allowedTypes[randomTypeIndex(allowedTypes.length)]
                    : randomTypeIndex(typeCount)
            }
        }

        if (findFirstPossibleMove(matrix)) {
            return matrix
        }

        attempt += 1
    }

    return Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => randomTypeIndex(typeCount))
    )
}

function tileId(row, col) {
    return `${row}-${col}`
}

function Match3GameModal({ tileTypes, onClose }) {
    const boardPixelSize = BOARD_COLS * TILE_SIZE
    const [tiles, setTiles] = useState([])
    const [score, setScore] = useState(0)
    const [movesLeft, setMovesLeft] = useState(MAX_MOVES)
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME_SECONDS)
    const [roundId, setRoundId] = useState(0)
    const [selectedTileId, setSelectedTileId] = useState('')
    const [hintedTileIds, setHintedTileIds] = useState([])
    const [floatingScores, setFloatingScores] = useState([])
    const [message, setMessage] = useState({
        type: '',
        title: '',
        body: ''
    })
    const [isInteractionLocked, setIsInteractionLocked] = useState(true)

    const boardRef = useRef([])
    const tileTypesRef = useRef(createTileTypeMap(tileTypes))
    const tileIdCounterRef = useRef(0)
    const timersRef = useRef(new Set())
    const scoreRef = useRef(0)
    const movesLeftRef = useRef(MAX_MOVES)
    const timeLeftRef = useRef(ROUND_TIME_SECONDS)
    const hintTimeoutRef = useRef(0)
    const roundTimerIntervalRef = useRef(0)
    const initializeTokenRef = useRef(0)

    const clearTimer = (timerId) => {
        if (!timerId) {
            return
        }

        window.clearTimeout(timerId)
        timersRef.current.delete(timerId)
    }

    const clearRoundTimer = () => {
        if (!roundTimerIntervalRef.current) {
            return
        }

        window.clearInterval(roundTimerIntervalRef.current)
        roundTimerIntervalRef.current = 0
    }

    const schedule = (callback, delay) => {
        const timerId = window.setTimeout(() => {
            timersRef.current.delete(timerId)
            callback()
        }, delay)
        timersRef.current.add(timerId)
        return timerId
    }

    const getNextTileId = () => {
        tileIdCounterRef.current += 1
        return `match-tile-${tileIdCounterRef.current}`
    }

    const createTile = (typeIndex, row, col, renderRow) => {
        const tileType = tileTypesRef.current[typeIndex]
        return {
            id: getNextTileId(),
            typeIndex,
            row,
            col,
            renderRow: typeof renderRow === 'number' ? renderRow : row,
            renderCol: col,
            isRemoving: false,
            tileType
        }
    }

    const flattenBoard = (board) =>
        board
            .reduce((list, row) => list.concat(row.filter(Boolean)), [])
            .sort((first, second) => {
                if (first.row === second.row) {
                    return first.col - second.col
                }

                return first.row - second.row
            })

    const renderBoard = (board) => {
        boardRef.current = board
        setTiles(flattenBoard(board))
    }

    const getTilePosition = (tileIdValue) => {
        const board = boardRef.current
        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                if (board[row][col] && board[row][col].id === tileIdValue) {
                    return { row, col, tile: board[row][col] }
                }
            }
        }

        return null
    }

    const toTypeMatrix = (board) =>
        board.map((row) => row.map((tile) => (tile ? tile.typeIndex : null)))

    const openGameModal = () => {
        initializeBoard()
    }

    const closeGameModal = () => {
        onClose()
    }

    const checkMatches = (board) => findMatchGroupsInTypeMatrix(toTypeMatrix(board))

    const showFloatingScore = (group, comboMultiplier, scoreValue) => {
        const totalRows = group.cells.reduce((sum, cell) => sum + cell.row, 0)
        const totalCols = group.cells.reduce((sum, cell) => sum + cell.col, 0)
        const averageRow = totalRows / group.cells.length
        const averageCol = totalCols / group.cells.length
        const floatingScore = {
            id: `${Date.now()}-${Math.random()}`,
            text: `+${scoreValue}${comboMultiplier > 1 ? ` x${comboMultiplier}` : ''}`,
            left: averageCol * TILE_SIZE + TILE_SIZE / 2,
            top: averageRow * TILE_SIZE + TILE_SIZE / 2
        }

        setFloatingScores((current) => current.concat(floatingScore))
        schedule(() => {
            setFloatingScores((current) =>
                current.filter((entry) => entry.id !== floatingScore.id)
            )
        }, 900)
    }

    const calculateScore = (groups, comboMultiplier) => {
        return groups.reduce((total, group) => total + calculateMatchScore(group.cells.length), 0) * comboMultiplier
    }

    const removeMatchedTiles = async (board, groups, comboMultiplier) => {
        const matchedMap = {}
        const scoreGain = calculateScore(groups, comboMultiplier)

        groups.forEach((group) => {
            group.cells.forEach((cell) => {
                matchedMap[tileId(cell.row, cell.col)] = true
                if (board[cell.row][cell.col]) {
                    board[cell.row][cell.col].isRemoving = true
                }
            })
        })

        renderBoard(board)
        await wait(REMOVE_ANIMATION_MS)

        groups.forEach((group) => {
            const groupScore = calculateMatchScore(group.cells.length)
            showFloatingScore(group, comboMultiplier, groupScore)
        })

        scoreRef.current += scoreGain
        setScore(scoreRef.current)

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                if (matchedMap[tileId(row, col)]) {
                    board[row][col] = null
                }
            }
        }

        renderBoard(board)
        await wait(60)
        return scoreGain
    }

    const applyGravity = (board) => {
        const refillPlan = Array(BOARD_COLS).fill(0)

        for (let col = 0; col < BOARD_COLS; col += 1) {
            const survivors = []

            for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
                if (board[row][col]) {
                    survivors.push(board[row][col])
                }
            }

            refillPlan[col] = BOARD_ROWS - survivors.length

            for (let row = BOARD_ROWS - 1, survivorIndex = 0; row >= 0; row -= 1) {
                if (survivorIndex < survivors.length) {
                    const tile = survivors[survivorIndex]
                    const previousRow = tile.row
                    tile.row = row
                    tile.col = col
                    tile.renderCol = col
                    tile.renderRow = previousRow
                    board[row][col] = tile
                    survivorIndex += 1
                } else {
                    board[row][col] = null
                }
            }
        }

        return refillPlan
    }

    const refillTiles = (board, refillPlan) => {
        const typeCount = tileTypesRef.current.length

        for (let col = 0; col < BOARD_COLS; col += 1) {
            if (!refillPlan[col]) {
                continue
            }

            for (let row = 0; row < refillPlan[col]; row += 1) {
                board[row][col] = createTile(
                    randomTypeIndex(typeCount),
                    row,
                    col,
                    -refillPlan[col] + row
                )
            }
        }
    }

    const animateBoard = async (board, duration) => {
        renderBoard(board)
        await nextFrame()

        for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let col = 0; col < BOARD_COLS; col += 1) {
                if (board[row][col]) {
                    board[row][col].renderRow = board[row][col].row
                    board[row][col].renderCol = board[row][col].col
                }
            }
        }

        renderBoard(board)
        await wait(duration)
    }

    const resolveCascades = async (board) => {
        let comboMultiplier = 1
        let step = 0
        let totalScoreGain = 0

        // Resolve until the board stabilizes, but cap the loop defensively.
        while (step < MAX_RESOLVE_STEPS) {
            const groups = checkMatches(board)

            if (!groups.length) {
                break
            }

            totalScoreGain += await removeMatchedTiles(board, groups, comboMultiplier)
            const refillPlan = applyGravity(board)
            refillTiles(board, refillPlan)
            await animateBoard(board, FALL_ANIMATION_MS)
            comboMultiplier += 1
            step += 1
        }

        return totalScoreGain
    }

    const checkForPossibleMoves = (board) => findFirstPossibleMove(toTypeMatrix(board))

    const showLostMessage = (body) => {
        clearRoundTimer()
        setMessage({
            type: 'lost',
            title: 'No more possible moves',
            body: body || 'No more possible moves. You lost!'
        })
        setIsInteractionLocked(true)
    }

    const showWinMessage = (remainingMoves) => {
        clearRoundTimer()
        setMessage({
            type: 'win',
            title: 'You win!',
            body: `You reached ${TARGET_SCORE} points with ${remainingMoves} moves and ${timeLeftRef.current}s left.`
        })
        setIsInteractionLocked(true)
    }

    const finalizeTurn = (nextMovesLeft, nextScore) => {
        const board = boardRef.current
        const possibleMove = checkForPossibleMoves(board)

        if (nextScore >= TARGET_SCORE) {
            showWinMessage(nextMovesLeft)
            return
        }

        if (!possibleMove) {
            showLostMessage('No more possible moves. You lost!')
            return
        }

        if (nextMovesLeft <= 0) {
            clearRoundTimer()
            setMessage({
                type: 'lost',
                title: 'Out of moves',
                body: 'You ran out of moves before reaching the target score.'
            })
            setIsInteractionLocked(true)
            return
        }

        setIsInteractionLocked(false)
    }

    const swapTiles = async (firstPosition, secondPosition) => {
        const board = boardRef.current
        const firstTile = board[firstPosition.row][firstPosition.col]
        const secondTile = board[secondPosition.row][secondPosition.col]

        firstTile.row = secondPosition.row
        firstTile.col = secondPosition.col
        secondTile.row = firstPosition.row
        secondTile.col = firstPosition.col
        firstTile.renderRow = firstPosition.row
        firstTile.renderCol = firstPosition.col
        secondTile.renderRow = secondPosition.row
        secondTile.renderCol = secondPosition.col
        board[firstPosition.row][firstPosition.col] = secondTile
        board[secondPosition.row][secondPosition.col] = firstTile

        await animateBoard(board, SWAP_ANIMATION_MS)
    }

    const evaluateCompletedMove = async () => {
        await resolveCascades(boardRef.current)
        const nextMovesLeft = movesLeftRef.current - 1
        movesLeftRef.current = nextMovesLeft
        setMovesLeft(nextMovesLeft)
        finalizeTurn(nextMovesLeft, scoreRef.current)
    }

    const trySwap = async (firstPosition, secondPosition) => {
        setIsInteractionLocked(true)
        setSelectedTileId('')
        setHintedTileIds([])

        await swapTiles(firstPosition, secondPosition)

        if (!checkMatches(boardRef.current).length) {
            await swapTiles(secondPosition, firstPosition)
            setIsInteractionLocked(false)
            return
        }

        await evaluateCompletedMove()
    }

    const handleTileSelection = async (tileIdValue) => {
        if (isInteractionLocked || message.type) {
            return
        }

        const tilePosition = getTilePosition(tileIdValue)
        if (!tilePosition) {
            return
        }

        if (!selectedTileId) {
            setSelectedTileId(tileIdValue)
            return
        }

        if (selectedTileId === tileIdValue) {
            setSelectedTileId('')
            return
        }

        const selectedPosition = getTilePosition(selectedTileId)
        if (!selectedPosition) {
            setSelectedTileId(tileIdValue)
            return
        }

        if (!isAdjacent(selectedPosition, tilePosition)) {
            setSelectedTileId(tileIdValue)
            return
        }

        await trySwap(selectedPosition, tilePosition)
    }

    const showHints = () => {
        if (isInteractionLocked || message.type) {
            return
        }

        const possibleMove = checkForPossibleMoves(boardRef.current)
        if (!possibleMove) {
            showLostMessage('No more possible moves. You lost!')
            return
        }

        setHintedTileIds(possibleMove.map((cell) => {
            const tile = boardRef.current[cell.row][cell.col]
            return tile ? tile.id : ''
        }).filter(Boolean))

        clearTimer(hintTimeoutRef.current)
        hintTimeoutRef.current = schedule(() => {
            setHintedTileIds([])
        }, HINT_DURATION_MS)
    }

    const initializeBoard = async () => {
        const initializeToken = initializeTokenRef.current + 1
        initializeTokenRef.current = initializeToken
        setIsInteractionLocked(true)
        setSelectedTileId('')
        setHintedTileIds([])
        setFloatingScores([])
        setMessage({
            type: '',
            title: '',
            body: ''
        })
        clearTimer(hintTimeoutRef.current)
        hintTimeoutRef.current = 0
        setScore(0)
        setMovesLeft(MAX_MOVES)
        setTimeLeft(ROUND_TIME_SECONDS)
        scoreRef.current = 0
        movesLeftRef.current = MAX_MOVES
        timeLeftRef.current = ROUND_TIME_SECONDS
        tileIdCounterRef.current = 0
        clearRoundTimer()

        const typeMatrix = createInitialTypeMatrix(tileTypesRef.current.length)
        const board = typeMatrix.map((row, rowIndex) =>
            row.map((typeIndex, colIndex) =>
                createTile(typeIndex, rowIndex, colIndex, rowIndex - BOARD_ROWS - 1 - randomTypeIndex(3))
            )
        )

        renderBoard(board)
        await animateBoard(board, FALL_ANIMATION_MS + 120)

        if (initializeToken !== initializeTokenRef.current) {
            return
        }

        const possibleMove = checkForPossibleMoves(board)
        if (!possibleMove) {
            showLostMessage('No more possible moves. You lost!')
            return
        }

        setIsInteractionLocked(false)
        roundTimerIntervalRef.current = window.setInterval(() => {
            const nextTimeLeft = timeLeftRef.current - 1
            timeLeftRef.current = nextTimeLeft
            setTimeLeft(nextTimeLeft)

            if (nextTimeLeft > 0) {
                return
            }

            clearRoundTimer()
            setMessage({
                type: 'lost',
                title: 'Time up',
                body: `Time is up. You needed ${TARGET_SCORE} points before the timer expired.`
            })
            setIsInteractionLocked(true)
        }, 1000)
    }

    const restartGame = () => {
        setRoundId((currentRoundId) => currentRoundId + 1)
    }

    const boardScale = Math.max(
        0.62,
        Math.min(
            1,
            (window.innerWidth - 48) / boardPixelSize,
            (window.innerHeight - 280) / boardPixelSize
        )
    )

    useEffect(() => {
        openGameModal()
    }, [roundId])

    useEffect(() => {
        return () => {
            clearTimer(hintTimeoutRef.current)
            clearRoundTimer()
            timersRef.current.forEach((timerId) => {
                window.clearTimeout(timerId)
            })
            timersRef.current.clear()
        }
    }, [])

    return (
        <div className='match3-modal-backdrop' onClick={closeGameModal}>
            <section
                className='match3-modal'
                role='dialog'
                aria-modal='true'
                aria-label='Drawn Fellows Match'
                onClick={(event) => event.stopPropagation()}>
                <button
                    type='button'
                    className='match3-close'
                    onClick={closeGameModal}
                    aria-label='Close game'>
                    ×
                </button>

                <div className='match3-shell'>
                    <header className='match3-header'>
                        <button
                            type='button'
                            className='match3-hint-button'
                            onClick={showHints}
                            disabled={isInteractionLocked}>
                            Hint
                        </button>
                        <div className='match3-title-wrap'>
                            <h2>Drawn Fellows Match</h2>
                            <p>Match 3 or more identical avatars. Reach {TARGET_SCORE} points before you run out of moves or time.</p>
                        </div>
                        <div className='match3-stats'>
                            <div className='match3-stat'>
                                <span>Score</span>
                                <strong>{score}</strong>
                            </div>
                            <div className='match3-stat'>
                                <span>Goal</span>
                                <strong>{TARGET_SCORE}</strong>
                            </div>
                            <div className='match3-stat'>
                                <span>Moves</span>
                                <strong>{movesLeft}</strong>
                            </div>
                            <div className='match3-stat'>
                                <span>Time</span>
                                <strong>{timeLeft}s</strong>
                            </div>
                        </div>
                    </header>

                    <div className='match3-board-wrap'>
                        <div
                            className={`match3-board ${isInteractionLocked ? 'is-locked' : ''}`}
                            style={{
                                width: `${boardPixelSize}px`,
                                height: `${boardPixelSize}px`,
                                transform: `scale(${boardScale})`
                            }}>
                            {tiles.map((tile) => (
                                <button
                                    key={tile.id}
                                    type='button'
                                    className={`match3-tile ${
                                        tile.isRemoving ? 'is-removing' : ''
                                    } ${
                                        selectedTileId === tile.id ? 'is-selected' : ''
                                    } ${
                                        hintedTileIds.indexOf(tile.id) !== -1 ? 'is-hinted' : ''
                                    } ${tile.tileType.shapeClass}`}
                                    style={{
                                        width: `${TILE_SIZE}px`,
                                        height: `${TILE_SIZE}px`,
                                        transform: `translate(${tile.renderCol * TILE_SIZE}px, ${tile.renderRow * TILE_SIZE}px)`
                                    }}
                                    onClick={() => handleTileSelection(tile.id)}
                                    disabled={isInteractionLocked}>
                                    <span className='match3-tile-shell'>
                                        <img
                                            src={tile.tileType.avatarSrc}
                                            alt={tile.tileType.label}
                                            className='match3-avatar'
                                            onError={(event) => {
                                                event.currentTarget.onerror = null
                                                event.currentTarget.src =
                                                    tile.tileType.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                            }}
                                        />
                                    </span>
                                </button>
                            ))}

                            {floatingScores.map((floatingScore) => (
                                <div
                                    key={floatingScore.id}
                                    className='match3-floating-score'
                                    style={{
                                        left: `${floatingScore.left}px`,
                                        top: `${floatingScore.top}px`
                                    }}>
                                    {floatingScore.text}
                                </div>
                            ))}

                            {message.type ? (
                                <div className={`match3-message-overlay is-${message.type}`}>
                                    <div className='match3-message-panel'>
                                        <h3>{message.title}</h3>
                                        <p>{message.body}</p>
                                        <div className='match3-message-actions'>
                                            <button
                                                type='button'
                                                className='match3-primary-button'
                                                onClick={restartGame}>
                                                Restart
                                            </button>
                                            <button
                                                type='button'
                                                className='match3-secondary-button'
                                                onClick={closeGameModal}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <footer className='match3-footer'>
                        <div className='match3-tile-legend'>
                            {tileTypesRef.current.map((tileType) => (
                                <div key={tileType.id} className='match3-legend-item'>
                                    <span className={`match3-legend-shape ${tileType.shapeClass}`}>
                                        <img
                                            src={tileType.avatarSrc}
                                            alt={tileType.label}
                                            className='match3-avatar'
                                            onError={(event) => {
                                                event.currentTarget.onerror = null
                                                event.currentTarget.src =
                                                    tileType.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                            }}
                                        />
                                    </span>
                                    <span>{tileType.displayLabel}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            type='button'
                            className='match3-secondary-button'
                            onClick={restartGame}>
                            Restart
                        </button>
                    </footer>
                </div>
            </section>
        </div>
    )
}

export default Match3GameModal
