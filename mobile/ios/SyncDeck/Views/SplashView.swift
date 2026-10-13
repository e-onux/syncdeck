import SwiftUI
import QuartzCore

/// Launch animation from docs/designs/splash: the camera starts low over the
/// app icon's chevrons (tips towards us) while they light up in faster and
/// faster waves, then rises to a top-down view, flashes and reveals the
/// wordmark. Every element is a function of the elapsed time, mirroring the
/// design's keyframes, so the timings below are the design's own numbers.
struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? SplashTimeline.total : context.date.timeIntervalSince(start)
            SplashFrame(t: t)
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "SyncDeck"))
    }

    /// When the wordmark has settled and the app may take over.
    static var duration: Duration {
        .milliseconds(Int(SplashTimeline.handoff * 1000))
    }
}

enum SplashTimeline {
    /// Wave lengths: each pass over the three chevrons is quicker than the last.
    static let waves: [Double] = [0.36, 0.3, 0.26, 0.24, 0.22, 0.2, 0.18, 0.16]
    static let first = 0.3
    /// The top-down flash.
    static let flash = first + waves.reduce(0, +)
    /// End of the mark's own animation.
    static let total = flash + 1.2
    /// Wordmark and tagline have risen.
    static let handoff = flash + 0.5 + 0.8

    struct Pulse { var row: Int; var time: Double; var length: Double; var peak: Double }

    static let pulses: [Pulse] = {
        var t = first
        var result: [Pulse] = []
        for (wave, length) in waves.enumerated() {
            let peak = 0.4 + 0.6 * Double(wave) / Double(waves.count - 1)
            for row in 0..<3 { result.append(Pulse(row: row, time: t + Double(row) * length / 3, length: length, peak: peak)) }
            t += length
        }
        return result
    }()
}

private enum Palette {
    static let canvas = Color(hex: 0x0C1F1C)
    static let mint = Color(hex: 0x5FD6B6)
    static let cyan = Color(hex: 0x3FB8C7)
    static let spark = Color(hex: 0xEAFFF8)
    static let ink = Color(hex: 0xEAF0EE)
    static let inkFaint = Color(hex: 0x68756F)
}

private struct SplashFrame: View {
    let t: Double

    var body: some View {
        let F = SplashTimeline.flash
        ZStack {
            Palette.canvas
            DotField()
                .opacity(Ease.out(progress(t, 0, 1.2)))
            VStack(spacing: 34) {
                ZStack {
                    Glow(t: t - (F - 0.08))
                    ChevronMark(t: t)
                        .projectionEffect(Camera.at(t).projection(size: ChevronMark.size))
                        .opacity(Camera.opacity(t))
                }
                .frame(width: 132, height: 129)
                VStack(spacing: 14) {
                    (Text(verbatim: "SYNC") + Text(verbatim: "DECK").foregroundColor(Palette.mint))
                        .font(.system(size: 40, weight: .heavy).width(.expanded).italic())
                        .tracking(-0.72)
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .rise(t, delay: F + 0.3)
                    Text(verbatim: "Powerful all in one Synchronisation".uppercased())
                        .font(.system(size: 11, design: .monospaced))
                        .tracking(2.64)
                        .foregroundStyle(Palette.inkFaint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .rise(t, delay: F + 0.5)
                }
                .padding(.horizontal, 24)
            }
            .padding(.bottom, 40)
            LoadingBar(t: t)
        }
    }
}

/// The code-grid dot texture, faded out towards the edges.
private struct DotField: View {
    var body: some View {
        Canvas { context, size in
            let pitch: CGFloat = 34
            var y: CGFloat = 0
            while y <= size.height {
                var x: CGFloat = 0
                while x <= size.width {
                    context.fill(Path(ellipseIn: CGRect(x: x - 1.2, y: y - 1.2, width: 2.4, height: 2.4)), with: .color(Palette.mint.opacity(0.22)))
                    x += pitch
                }
                y += pitch
            }
        }
        .mask {
            GeometryReader { proxy in
                let size = proxy.size
                EllipticalGradient(colors: [.black, .clear], startRadiusFraction: 0, endRadiusFraction: 0.375)
                    .frame(width: size.width * 1.4, height: size.height * 1.1)
                    .position(x: size.width * 0.5, y: size.height * 0.45)
            }
        }
    }
}

/// Soft mint bloom behind the mark when the camera lands.
private struct Glow: View {
    let t: Double

    var body: some View {
        let u = progress(t, 0, 1.6)
        let opacity = t <= 0 || u >= 1 ? 0 : (u < 0.4 ? 0.55 * Ease.out(u / 0.4) : 0.55 * (1 - Ease.out((u - 0.4) / 0.6)))
        Circle()
            .fill(RadialGradient(colors: [Palette.mint.opacity(0.3), .clear], center: .center, startRadius: 0, endRadius: 130 * 0.65))
            .frame(width: 260, height: 260)
            .scaleEffect(0.6 + 0.9 * Ease.out(u))
            .opacity(opacity)
            .allowsHitTesting(false)
    }
}

private struct LoadingBar: View {
    let t: Double

    var body: some View {
        let F = SplashTimeline.flash
        VStack(spacing: 14) {
            Rectangle()
                .fill(Palette.ink.opacity(0.09))
                .frame(height: 1)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Palette.mint)
                        .scaleEffect(x: Ease.bar(progress(t, 0.4, F + 0.6)), y: 1, anchor: .leading)
                }
            HStack {
                (Text(verbatim: "↻ ").foregroundColor(Palette.mint) + Text("Preparing profiles"))
                    .textCase(.uppercase)
                Spacer()
                Text(verbatim: "SIDRE LABS")
            }
            .font(.system(size: 10, design: .monospaced))
            .tracking(2)
            .foregroundStyle(Palette.inkFaint)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 40)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, 64)
        .opacity(Ease.out(progress(t, 0.3, 0.6)))
    }
}

/// The app icon's three chevrons, drawn in the icon's 1024 coordinate space
/// (viewBox 250 256 524 512 scaled to 132 x 129).
private struct ChevronMark: View {
    let t: Double

    static let size = CGSize(width: 132, height: 129)
    /// Room for glows and round caps outside the 132 x 129 box.
    static let bleed: CGFloat = 48

    struct Row { var points: [CGPoint]; var color: Color; var width: CGFloat; var opacity: Double }

    static let rows: [Row] = [
        Row(points: [CGPoint(x: 278, y: 284), CGPoint(x: 512, y: 427), CGPoint(x: 746, y: 284)], color: Palette.mint, width: 48, opacity: 1),
        Row(points: [CGPoint(x: 278, y: 440), CGPoint(x: 512, y: 583), CGPoint(x: 746, y: 440)], color: Palette.mint, width: 46, opacity: 0.6),
        Row(points: [CGPoint(x: 278, y: 596), CGPoint(x: 512, y: 739), CGPoint(x: 746, y: 596)], color: Palette.cyan, width: 44, opacity: 0.9),
    ]

    static let scale = min(size.width / 524, size.height / 512)

    var body: some View {
        Canvas { context, _ in
            let s = Self.scale
            let origin = CGPoint(x: Self.bleed - 250 * s, y: Self.bleed + (Self.size.height - 512 * s) / 2 - 256 * s)
            for (i, row) in Self.rows.enumerated() {
                var path = Path()
                path.addLines(row.points.map { CGPoint(x: origin.x + $0.x * s, y: origin.y + $0.y * s) })
                let tracks = MarkTracks.row(i)
                stroke(context, path, row.color, row.width * s, opacity: row.opacity * tracks.base.value(t))
                stroke(context, path, row.color, row.width * s, opacity: tracks.lit.value(t), glow: 22 * s)
                let spark = tracks.sparkOpacity.value(t)
                if spark > 0.001 {
                    var sparkContext = context
                    sparkContext.opacity = spark
                    sparkContext.addFilter(.shadow(color: Palette.spark, radius: 8 * s / 2))
                    for segment in dashSegments(offset: tracks.sparkOffset.value(t)) {
                        sparkContext.stroke(path.trimmedPath(from: segment.lowerBound, to: segment.upperBound), with: .color(Palette.spark), style: Self.style(row.width * s * 0.42))
                    }
                }
                stroke(context, path, Palette.spark, row.width * s * 0.5, opacity: tracks.core.value(t), glow: 10 * s)
            }
        }
        .frame(width: Self.size.width + Self.bleed * 2, height: Self.size.height + Self.bleed * 2)
        .frame(width: Self.size.width, height: Self.size.height)
    }

    private static func style(_ width: CGFloat) -> StrokeStyle {
        StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
    }

    private func stroke(_ context: GraphicsContext, _ path: Path, _ color: Color, _ width: CGFloat, opacity: Double, glow: CGFloat? = nil) {
        guard opacity > 0.001 else { return }
        var layer = context
        layer.opacity = opacity
        if let glow { layer.addFilter(.shadow(color: color, radius: glow / 2)) }
        layer.stroke(path, with: .color(color), style: Self.style(width))
    }

    /// The visible parts of a "0.22 on, 1.3 off" dash on a path of length 1.
    private func dashSegments(offset: Double) -> [ClosedRange<Double>] {
        let period = 1.52
        return (-1...2).compactMap { k in
            let from = Double(k) * period - offset
            let lower = max(0, from), upper = min(1, from + 0.22)
            return lower < upper ? lower...upper : nil
        }
    }
}

/// Per-chevron opacity tracks: dimmed base, the travelling wave, sparks
/// inside the bar and the white-hot core of the final flash.
private struct MarkTracks {
    var base: Track
    var lit: Track
    var sparkOpacity: Track
    var sparkOffset: Track
    var core: Track

    private static let all: [MarkTracks] = (0..<3).map(make)

    static func row(_ i: Int) -> MarkTracks { all[i] }

    private static func make(_ i: Int) -> MarkTracks {
        let F = SplashTimeline.flash, T = SplashTimeline.total, dim = 0.3
        let mine = SplashTimeline.pulses.filter { $0.row == i }
        func before(_ keys: [Track.Key]) -> [Track.Key] { keys.filter { $0.time < F - 0.001 } }

        let base = before([.init(0, 0), .init(0.25, dim)]) + [.init(F, dim), .init(F + 0.04, 1), .init(T, 1)]

        var lit: [Track.Key] = [.init(0, 0)]
        for p in mine { lit += [.init(p.time, 0), .init(p.time + 0.04, p.peak), .init(p.time + 0.04 + p.length * 0.5, 0)] }
        lit = before(lit) + [.init(F, 0), .init(F + 0.03, 1), .init(F + 0.7, 0), .init(T, 0)]

        var opacity: [Track.Key] = [.init(0, 0)], offset: [Track.Key] = [.init(0, 1.25)]
        for p in mine.dropFirst(2) {
            opacity += [.init(p.time, 0), .init(p.time + 0.03, 1), .init(p.time + p.length * 0.7, 0)]
            offset += [.init(p.time, 1.25), .init(p.time + 0.03, 1.1), .init(p.time + p.length * 0.7, -0.25)]
        }
        let last = F + 0.05 + Double(i) * 0.14
        opacity = before(opacity) + [.init(F, 0), .init(last, 0), .init(last + 0.12, 1), .init(last + 0.8, 0), .init(T, 0)]
        offset = before(offset) + [.init(F, 1.25), .init(last, 1.25), .init(last + 0.12, 0.95), .init(last + 0.8, -0.25), .init(T, -0.25)]

        let core: [Track.Key] = [.init(0, 0), .init(F, 0), .init(F + 0.03, 1), .init(F + 0.09, 0.25), .init(F + 0.13, 0.9), .init(F + 0.55, 0), .init(T, 0)]
        return MarkTracks(base: Track(base), lit: Track(lit), sparkOpacity: Track(opacity), sparkOffset: Track(offset), core: Track(core))
    }
}

/// Piecewise-linear keyframes, held at both ends.
struct Track {
    struct Key { var time: Double; var value: Double; init(_ time: Double, _ value: Double) { self.time = time; self.value = value } }
    var keys: [Key]

    init(_ keys: [Key]) { self.keys = keys }

    func value(_ t: Double) -> Double {
        guard let first = keys.first, let last = keys.last else { return 0 }
        if t <= first.time { return first.value }
        if t >= last.time { return last.value }
        let i = keys.lastIndex { $0.time <= t } ?? 0
        let a = keys[i], b = keys[i + 1]
        let span = b.time - a.time
        return span <= 0 ? b.value : a.value + (b.value - a.value) * (t - a.time) / span
    }
}

/// Camera over the mark: low and tilted ("road view"), then up to top-down.
private struct Camera {
    var tilt: Double, roll: Double, zoom: Double, lift: Double

    private struct Key { var time: Double; var camera: Camera; var eased = false }

    private static let keys: [Key] = {
        let F = SplashTimeline.flash
        return [
            Key(time: 0, camera: Camera(tilt: 70, roll: -10, zoom: 3.6, lift: 30)),
            Key(time: 0.3, camera: Camera(tilt: 68, roll: -8, zoom: 3.4, lift: 20)),
            Key(time: F - 0.9, camera: Camera(tilt: 62, roll: -3, zoom: 2.6, lift: 0)),
            Key(time: F, camera: Camera(tilt: 0, roll: 0, zoom: 1, lift: 0), eased: true),
            Key(time: F + 0.08, camera: Camera(tilt: 0, roll: 0, zoom: 1.06, lift: 0)),
            Key(time: F + 0.4, camera: Camera(tilt: 0, roll: 0, zoom: 1, lift: 0)),
        ]
    }()

    static func opacity(_ t: Double) -> Double { progress(t, 0, 0.3) }

    static func at(_ t: Double) -> Camera {
        guard t > 0 else { return keys[0].camera }
        guard let next = keys.firstIndex(where: { $0.time > t }) else { return keys[keys.count - 1].camera }
        let a = keys[next - 1], b = keys[next]
        var u = (t - a.time) / (b.time - a.time)
        if b.eased { u = Ease.camera(u) }
        func mix(_ x: Double, _ y: Double) -> Double { x + (y - x) * u }
        return Camera(tilt: mix(a.camera.tilt, b.camera.tilt), roll: mix(a.camera.roll, b.camera.roll),
                      zoom: mix(a.camera.zoom, b.camera.zoom), lift: mix(a.camera.lift, b.camera.lift))
    }

    /// CSS `perspective(520px) rotateX() rotateZ() scale() translateY()` about
    /// the centre of a view of `size`.
    func projection(size: CGSize) -> ProjectionTransform {
        func matrix(_ build: (inout CATransform3D) -> Void) -> CATransform3D {
            var m = CATransform3DIdentity
            build(&m)
            return m
        }
        let x = tilt * .pi / 180, z = roll * .pi / 180
        let perspective = matrix { $0.m34 = -1 / 520 }
        let rotateX = matrix { $0.m22 = cos(x); $0.m23 = sin(x); $0.m32 = -sin(x); $0.m33 = cos(x) }
        let rotateZ = matrix { $0.m11 = cos(z); $0.m12 = sin(z); $0.m21 = -sin(z); $0.m22 = cos(z) }
        let scale = matrix { $0.m11 = zoom; $0.m22 = zoom }
        let translate = matrix { $0.m42 = lift }
        let toOrigin = CATransform3DMakeTranslation(-size.width / 2, -size.height / 2, 0)
        let back = CATransform3DMakeTranslation(size.width / 2, size.height / 2, 0)
        // Row vectors: the rightmost CSS function applies first.
        let chain = [toOrigin, translate, scale, rotateZ, rotateX, perspective, back]
        return ProjectionTransform(chain.dropFirst().reduce(chain[0], CATransform3DConcat))
    }
}

private func progress(_ t: Double, _ delay: Double, _ duration: Double) -> Double {
    min(1, max(0, (t - delay) / duration))
}

private enum Ease {
    static func out(_ u: Double) -> Double { bezier(0.2, 0.7, 0.2, 1, u) }
    static func bar(_ u: Double) -> Double { bezier(0.6, 0.05, 0.3, 1, u) }
    static func camera(_ u: Double) -> Double { bezier(0.65, 0, 0.2, 1, u) }

    /// CSS cubic-bezier(x1, y1, x2, y2) at progress `u`.
    static func bezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ u: Double) -> Double {
        guard u > 0 else { return 0 }
        guard u < 1 else { return 1 }
        func curve(_ a: Double, _ b: Double, _ s: Double) -> Double {
            3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s
        }
        var lo = 0.0, hi = 1.0, s = u
        for _ in 0..<30 {
            s = (lo + hi) / 2
            if curve(x1, x2, s) < u { lo = s } else { hi = s }
        }
        return curve(y1, y2, s)
    }
}

private extension View {
    /// Fade in while rising 22pt, the design's `sdRise`.
    func rise(_ t: Double, delay: Double) -> some View {
        let u = Ease.out(progress(t, delay, 0.8))
        return opacity(u).offset(y: 22 * (1 - u))
    }
}

#Preview {
    SplashView()
}
