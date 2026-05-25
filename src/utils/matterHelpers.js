const CHAMBER_SEGMENTS = 48
const GATE_SWING_ANGLE = 2.27
const CATEGORY_WORLD = 0x0002
const CATEGORY_SPINNER = 0x0004
const CATEGORY_BALL = 0x0008
const SPINNER_EASE_FACTOR = 0.012

export function buildMachineScene({ Matter, canvas, width, height, options, onAfterRender }) {
    const { Engine, Render, Runner, World, Bodies, Body, Events } = Matter

    const engine = Engine.create({
        gravity: { x: 0, y: 0.52 }
    })

    const render = Render.create({
        canvas,
        engine,
        options: {
            width,
            height,
            wireframes: false,
            background: 'transparent',
            pixelRatio: window.devicePixelRatio || 1
        }
    })

    const runner = Runner.create()
    const layout = createLayout(width, height)
    const invisible = { fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0 }

    const chamberWalls = createCircularWalls(Bodies, layout, invisible)
    const closedGatePose = getGatePose(layout, 0)
    const gateBody = Bodies.rectangle(
        closedGatePose.centerX,
        closedGatePose.centerY,
        layout.gateLength,
        layout.gateThickness,
        {
            isStatic: true,
            angle: closedGatePose.angle,
            chamfer: { radius: layout.gateThickness * 0.4 },
            render: invisible,
            collisionFilter: {
                category: CATEGORY_WORLD,
                mask: CATEGORY_BALL
            }
        }
    )

    const railMain = createSegmentBody(
        Bodies,
        layout.railMainStartX,
        layout.railMainStartY,
        layout.railMainEndX,
        layout.railMainEndY,
        layout.railThickness,
        invisible
    )
    const railLeftLip = createSegmentBody(
        Bodies,
        layout.railLeftLipX,
        layout.railLeftLipY,
        layout.railMainStartX,
        layout.railMainStartY,
        layout.railThickness,
        invisible
    )
    const floor = Bodies.rectangle(layout.centerX, height + 70, width + 160, 140, {
        isStatic: true,
        render: invisible,
        collisionFilter: {
            category: CATEGORY_WORLD,
            mask: CATEGORY_BALL
        }
    })

    const spinnerHub = Bodies.circle(layout.centerX, layout.centerY, layout.spinnerHubRadius, {
        isStatic: true,
        render: invisible,
        collisionFilter: {
            category: CATEGORY_SPINNER,
            mask: CATEGORY_BALL
        }
    })
    const spinnerArms = createSpinnerArms(Bodies, layout, invisible)

    const ballMap = new Map()
    const balls = options.map((option, index) => {
        const columnCount = Math.max(3, Math.floor((layout.chamberInnerRadius * 1.45) / (layout.ballRadius * 2)))
        const row = Math.floor(index / columnCount)
        const col = index % columnCount
        const rowWidth = Math.min(columnCount, options.length - row * columnCount)
        const startX = layout.centerX - ((rowWidth - 1) * layout.ballRadius * 2.05) / 2
        const spawnPosition = {
            x: startX + col * layout.ballRadius * 2.05,
            y: layout.ballStackBaseY - row * layout.ballRadius * 1.92
        }

        const ball = Bodies.circle(spawnPosition.x, spawnPosition.y, layout.ballRadius, {
            restitution: 0.88,
            friction: 0.005,
            frictionAir: 0.015,
            density: 0.0015,
            collisionFilter: {
                category: CATEGORY_BALL,
                mask: CATEGORY_WORLD | CATEGORY_SPINNER | CATEGORY_BALL
            },
            render: {
                fillStyle: '#f8fbff',
                strokeStyle: '#b9c5e4',
                lineWidth: 2
            }
        })

        ball.labelId = option.id
        ball.optionLabel = option.label
        ballMap.set(option.id, ball)
        return ball
    })

    World.add(engine.world, [
        ...chamberWalls,
        gateBody,
        railMain,
        railLeftLip,
        floor,
        spinnerHub,
        ...spinnerArms,
        ...balls
    ])

    const state = {
        ballMap,
        balls,
        drawnIds: new Set(),
        exitingIds: new Set(),
        isMixing: false,
        mixingIntensity: 1,
        spinnerSpeed: 0.018,
        spinnerTargetSpeed: 0.018,
        spinnerAngle: 0,
        activeDrawId: null,
        gateProgress: 0,
        gateTargetProgress: 0,
        spinnerArms,
        gateBody
    }

    const beforeUpdateHandler = () => {
        state.spinnerSpeed += (state.spinnerTargetSpeed - state.spinnerSpeed) * SPINNER_EASE_FACTOR
        state.spinnerAngle += state.spinnerSpeed
        syncSpinner(Body, state.spinnerArms, layout, state.spinnerAngle)

        state.gateProgress += (state.gateTargetProgress - state.gateProgress) * 0.24
        if (Math.abs(state.gateTargetProgress - state.gateProgress) < 0.001) {
            state.gateProgress = state.gateTargetProgress
        }

        const gatePose = getGatePose(layout, state.gateProgress)
        Body.setAngle(state.gateBody, gatePose.angle)
        Body.setPosition(state.gateBody, {
            x: gatePose.centerX,
            y: gatePose.centerY
        })
        state.gateBody.isSensor = state.gateProgress > 0.92

        state.balls.forEach((ball, index) => {
            if (state.drawnIds.has(ball.labelId)) {
                ball.collisionFilter.mask = CATEGORY_WORLD | CATEGORY_BALL
                return
            }

            const dx = ball.position.x - layout.centerX
            const dy = ball.position.y - layout.centerY
            const distance = Math.max(0.0001, Math.hypot(dx, dy))
            const isBelowChamber = ball.position.y > layout.openingY + layout.ballRadius * 1.1
            const isInOpenGateCaptureZone =
                state.gateProgress > 0.92 &&
                Math.abs(ball.position.x - layout.centerX) < layout.openingCaptureHalfWidth &&
                ball.position.y > layout.openingCaptureTopY
            const hasCommittedToExit =
                state.exitingIds.has(ball.labelId) ||
                isInOpenGateCaptureZone ||
                (state.gateProgress > 0.92 &&
                    Math.abs(ball.position.x - layout.centerX) < layout.openingCommitHalfWidth &&
                    ball.position.y > layout.openingCommitY)

            if (hasCommittedToExit) {
                state.exitingIds.add(ball.labelId)
                ball.collisionFilter.mask = CATEGORY_WORLD
            }

            const canExit =
                hasCommittedToExit ||
                (state.gateProgress > 0.92 &&
                ((Math.abs(ball.position.x - layout.centerX) < layout.openingLaneHalfWidth &&
                    ball.position.y > layout.openingLaneTopY) ||
                    isBelowChamber))

            const isInGatePocket =
                state.gateProgress < 0.2 &&
                Math.abs(ball.position.x - layout.centerX) < layout.gatePocketHalfWidth &&
                ball.position.y > layout.gatePocketTopY

            if (!canExit && distance > layout.chamberInnerRadius) {
                Body.setPosition(ball, {
                    x: layout.centerX + (dx / distance) * layout.chamberInnerRadius,
                    y: layout.centerY + (dy / distance) * layout.chamberInnerRadius
                })
                Body.setVelocity(ball, {
                    x: ball.velocity.x * 0.4,
                    y: ball.velocity.y * 0.4
                })
            }

            if (state.isMixing) {
                const tangentX = -dy / Math.max(30, distance)
                const tangentY = dx / Math.max(30, distance)
                const phase = engine.timing.timestamp / 210 + index * 0.8
                Body.applyForce(ball, ball.position, {
                    x: tangentX * 0.00018 * state.mixingIntensity + Math.sin(phase) * 0.00002,
                    y: tangentY * 0.00018 * state.mixingIntensity - 0.00004 * state.mixingIntensity
                })
            }

            if (isInGatePocket) {
                const horizontalDirection = dx === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(dx)
                Body.applyForce(ball, ball.position, {
                    x: horizontalDirection * 0.00022,
                    y: -0.0003
                })
            }

            if (state.exitingIds.has(ball.labelId)) {
                const horizontalPull = layout.centerX - ball.position.x
                Body.applyForce(ball, ball.position, {
                    x: horizontalPull * 0.00002,
                    y: 0.00075
                })

                if (ball.velocity.y < 4.4) {
                    Body.setVelocity(ball, {
                        x: ball.velocity.x * 0.92,
                        y: 4.4
                    })
                }
            }

            if (!canExit && distance > layout.chamberInnerRadius * 0.9) {
                Body.applyForce(ball, ball.position, {
                    x: (-dx / distance) * 0.0011,
                    y: (-dy / distance) * 0.0011
                })
            }
        })
    }

    const afterRenderHandler = () => {
        if (onAfterRender) {
            onAfterRender()
        }
    }

    Events.on(engine, 'beforeUpdate', beforeUpdateHandler)
    Events.on(render, 'afterRender', afterRenderHandler)
    Render.run(render)
    Runner.run(runner, engine)

    return {
        Matter,
        engine,
        render,
        runner,
        layout,
        state,
        beforeUpdateHandler,
        afterRenderHandler
    }
}

export function renderBallLabel(machine) {
    if (!machine?.render?.context) {
        return
    }

    drawMachineShell(machine)

    const { context } = machine.render
    const { balls, drawnIds, activeDrawId } = machine.state
    const radius = machine.layout.ballRadius

    context.save()
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `${Math.max(10, radius * 0.46)}px "Trebuchet MS", "Avenir Next", sans-serif`

    balls.forEach((ball) => {
        context.save()
        context.translate(ball.position.x, ball.position.y)
        context.rotate(ball.angle)
        context.fillStyle =
            drawnIds.has(ball.labelId) || activeDrawId === ball.labelId ? '#152e57' : '#30446c'
        const truncated = truncateLabel(ball.optionLabel)
        if (truncated.length > 8) {
            context.font = `${Math.max(8, radius * 0.35)}px "Trebuchet MS", "Avenir Next", sans-serif`
        }
        context.fillText(truncated, 0, 0, radius * 1.58)
        context.restore()
        context.font = `${Math.max(10, radius * 0.46)}px "Trebuchet MS", "Avenir Next", sans-serif`
    })

    context.restore()
}

function drawMachineShell(machine) {
    const { context } = machine.render
    const { layout, state } = machine
    const gateSegment = getGateSegment(layout, state.gateProgress)

    context.save()
    context.fillStyle = 'rgba(8, 19, 41, 0.3)'
    context.fillRect(0, 0, machine.render.options.width, machine.render.options.height)

    context.fillStyle = 'rgba(45, 75, 168, 0.28)'
    context.beginPath()
    context.arc(layout.centerX, layout.centerY, layout.chamberRadius, 0, Math.PI * 2)
    context.fill()

    context.strokeStyle = '#d7e7ff'
    context.lineWidth = 6
    context.beginPath()
    context.arc(layout.centerX, layout.centerY, layout.chamberRadius, 0, layout.openingRightAngle)
    context.stroke()
    context.beginPath()
    context.arc(
        layout.centerX,
        layout.centerY,
        layout.chamberRadius,
        layout.openingLeftAngle,
        Math.PI * 2
    )
    context.stroke()

    drawLine(
        context,
        layout.railLeftLipX,
        layout.railLeftLipY,
        layout.railMainStartX,
        layout.railMainStartY,
        '#f4d78e',
        8
    )
    drawLine(
        context,
        layout.railMainStartX,
        layout.railMainStartY,
        layout.railMainEndX,
        layout.railMainEndY,
        '#f4d78e',
        8
    )

    drawLine(
        context,
        gateSegment.x1,
        gateSegment.y1,
        gateSegment.x2,
        gateSegment.y2,
        '#d7e7ff',
        layout.gateThickness * 0.55
    )

    context.save()
    context.translate(layout.centerX, layout.centerY)
    context.rotate(state.spinnerAngle)
    context.fillStyle = '#334c96'
    for (let index = 0; index < 4; index += 1) {
        context.rotate(Math.PI / 2)
        const { drawX, drawY, drawWidth, drawHeight } = getSpinnerArmVisualRect(layout)
        roundRect(context, drawX, drawY, drawWidth, drawHeight, 6)
        context.fill()
    }
    context.restore()

    context.fillStyle = '#e0a741'
    context.beginPath()
    context.arc(layout.centerX, layout.centerY, layout.spinnerHubRadius, 0, Math.PI * 2)
    context.fill()
    context.restore()
}

function createCircularWalls(Bodies, layout, renderStyle) {
    const walls = []
    for (let index = 0; index < CHAMBER_SEGMENTS; index += 1) {
        const angle = (Math.PI * 2 * index) / CHAMBER_SEGMENTS
        const normalized = normalizeAngle(angle - Math.PI / 2)
        if (Math.abs(normalized) < layout.openingSpan / 2) {
            continue
        }

        walls.push(
            Bodies.rectangle(
                layout.centerX + Math.cos(angle) * layout.chamberRadius,
                layout.centerY + Math.sin(angle) * layout.chamberRadius,
                layout.wallThickness,
                layout.wallThickness * 2.1,
                {
                    isStatic: true,
                    angle: angle + Math.PI / 2,
                    render: renderStyle,
                    collisionFilter: {
                        category: CATEGORY_WORLD,
                        mask: CATEGORY_BALL
                    }
                }
            )
        )
    }
    return walls
}

function createSpinnerArms(Bodies, layout, renderStyle) {
    return new Array(4).fill(null).map((_, index) => {
        const angle = (Math.PI / 2) * index
        const armTransform = getSpinnerArmTransform(layout, angle)
        return Bodies.rectangle(
            armTransform.x,
            armTransform.y,
            layout.spinnerArmWidth,
            layout.spinnerArmLength,
            {
                isStatic: true,
                angle,
                chamfer: { radius: 6 },
                render: renderStyle,
                collisionFilter: {
                    category: CATEGORY_SPINNER,
                    mask: CATEGORY_BALL
                }
            }
        )
    })
}

function syncSpinner(Body, spinnerArms, layout, spinnerAngle) {
    spinnerArms.forEach((arm, index) => {
        const angle = spinnerAngle + (Math.PI / 2) * index
        const armTransform = getSpinnerArmTransform(layout, angle)
        Body.setAngle(arm, angle)
        Body.setPosition(arm, {
            x: armTransform.x,
            y: armTransform.y
        })
    })
}

function createSegmentBody(Bodies, x1, y1, x2, y2, thickness, renderStyle) {
    const dx = x2 - x1
    const dy = y2 - y1
    return Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(dx, dy), thickness, {
        isStatic: true,
        angle: Math.atan2(dy, dx),
        chamfer: { radius: Math.max(2, thickness * 0.35) },
        render: renderStyle,
        collisionFilter: {
            category: CATEGORY_WORLD,
            mask: CATEGORY_BALL
        }
    })
}

function createLayout(width, height) {
    const chamberRadius = Math.min(width * 0.34, height * 0.34, 185)
    const centerX = width / 2
    const centerY = chamberRadius + 60
    const ballRadius = Math.max(17, Math.min(24, chamberRadius * 0.135))
    const wallThickness = Math.max(14, chamberRadius * 0.1)
    const openingCenterAngle = Math.PI / 2
    const targetGateClearWidth = ballRadius * 2 * 1.2
    const targetGateChordWidth = targetGateClearWidth + wallThickness * 0.55
    const openingSpan = 2 * Math.asin(Math.min(0.999, targetGateChordWidth / (2 * chamberRadius)))
    const openingRightAngle = openingCenterAngle - openingSpan / 2
    const openingLeftAngle = openingCenterAngle + openingSpan / 2
    const gateHinge = pointOnCircle(centerX, centerY, chamberRadius, openingRightAngle)
    const gateLatch = pointOnCircle(centerX, centerY, chamberRadius, openingLeftAngle)
    const gateLength = distanceBetween(gateHinge, gateLatch)
    const gateThickness = Math.max(10, ballRadius * 0.5)
    const openingY = (gateHinge.y + gateLatch.y) / 2
    const openingWidth = gateLength
    const openingLaneHalfWidth = gateLength * 0.42
    const openingLaneTopY = openingY - ballRadius * 0.2

    const railMainStartX = centerX - chamberRadius * 0.82
    const railMainStartY = centerY + chamberRadius + 162
    const railMainEndX = centerX + chamberRadius * 0.58
    const railMainEndY = railMainStartY - 78
    const railLeftLipX = railMainStartX - 50
    const railLeftLipY = railMainStartY - 34

    const spinnerHubRadius = Math.max(12, chamberRadius * 0.09)
    const spinnerArmReach = chamberRadius * 0.8
    const spinnerArmInset = Math.max(spinnerHubRadius * 0.35, chamberRadius * 0.08)
    const spinnerArmLength = Math.max(48, spinnerArmReach - spinnerArmInset)
    const spinnerArmOffset = spinnerArmInset + spinnerArmLength / 2
    const chamberInnerRadius = chamberRadius - ballRadius - 6

    return {
        centerX,
        centerY,
        chamberRadius,
        chamberInnerRadius,
        wallThickness,
        ballRadius,
        openingSpan,
        openingCenterAngle,
        openingLeftAngle,
        openingRightAngle,
        openingY,
        openingWidth,
        openingClearWidth: targetGateClearWidth,
        openingLaneHalfWidth,
        openingLaneTopY,
        openingCaptureHalfWidth: targetGateClearWidth * 0.42,
        openingCaptureTopY: openingY - ballRadius * 0.55,
        openingCommitHalfWidth: targetGateClearWidth * 0.28,
        openingCommitY: openingY - ballRadius * 0.08,
        gatePocketHalfWidth: gateLength * 0.34,
        gatePocketTopY: openingY - ballRadius * 1.2,
        gateThickness,
        gateLength,
        gateSwingAngle: -GATE_SWING_ANGLE,
        gateHingeX: gateHinge.x,
        gateHingeY: gateHinge.y,
        closedGateAngle: angleBetween(gateHinge, gateLatch),
        railMainStartX,
        railMainStartY,
        railMainEndX,
        railMainEndY,
        railLeftLipX,
        railLeftLipY,
        railThickness: Math.max(12, ballRadius * 0.66),
        spinnerHubRadius,
        spinnerArmReach,
        spinnerArmInset,
        spinnerArmLength,
        spinnerArmWidth: Math.max(10, chamberRadius * 0.085),
        spinnerArmOffset,
        ballStackBaseY: centerY + chamberInnerRadius - ballRadius * 1.1
    }
}

function truncateLabel(label) {
    return label.length <= 9 ? label : `${label.slice(0, 8)}…`
}

function getSpinnerArmTransform(layout, angle) {
    return {
        x: layout.centerX + Math.sin(angle) * layout.spinnerArmOffset,
        y: layout.centerY - Math.cos(angle) * layout.spinnerArmOffset
    }
}

function getSpinnerArmVisualRect(layout) {
    return {
        drawX: -layout.spinnerArmWidth / 2,
        drawY: -layout.spinnerArmInset - layout.spinnerArmLength,
        drawWidth: layout.spinnerArmWidth,
        drawHeight: layout.spinnerArmLength
    }
}

function getGatePose(layout, progress) {
    const angle = layout.closedGateAngle + layout.gateSwingAngle * progress
    const centerX = layout.gateHingeX + Math.cos(angle) * (layout.gateLength / 2)
    const centerY = layout.gateHingeY + Math.sin(angle) * (layout.gateLength / 2)

    return {
        angle,
        centerX,
        centerY
    }
}

function getGateSegment(layout, progress) {
    const pose = getGatePose(layout, progress)
    return {
        x1: layout.gateHingeX,
        y1: layout.gateHingeY,
        x2: layout.gateHingeX + Math.cos(pose.angle) * layout.gateLength,
        y2: layout.gateHingeY + Math.sin(pose.angle) * layout.gateLength
    }
}

export function getPointOnRail(layout, t, ballRadiusOffset = 0) {
    const clamped = Math.max(0, Math.min(1, t))
    return {
        x: layout.railMainStartX + (layout.railMainEndX - layout.railMainStartX) * clamped,
        y:
            layout.railMainStartY +
            (layout.railMainEndY - layout.railMainStartY) * clamped -
            ballRadiusOffset
    }
}

export function getDrawTargets(layout) {
    return {
        stageAboveGate: {
            x: layout.centerX,
            y: layout.openingY - layout.ballRadius - 6
        },
        railEntry: getPointOnRail(layout, 0.9, layout.ballRadius * 0.58),
        railSettle: getPointOnRail(layout, 0.3, layout.ballRadius * 0.52)
    }
}

function pointOnCircle(centerX, centerY, radius, angle) {
    return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
    }
}

function distanceBetween(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y)
}

function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x)
}

function normalizeAngle(angle) {
    let result = angle
    while (result > Math.PI) result -= Math.PI * 2
    while (result < -Math.PI) result += Math.PI * 2
    return result
}

function roundRect(context, x, y, width, height, radius) {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
}

function drawLine(context, x1, y1, x2, y2, color, width) {
    context.strokeStyle = color
    context.lineWidth = width
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
}
