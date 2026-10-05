import ActivityKit
import SwiftUI
import WidgetKit

struct IslandLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: IslandAttributes.self) { context in
      IslandCardView(state: context.state)
        .activityBackgroundTint(IslandTheme.background)
        .activitySystemActionForegroundColor(IslandTheme.text)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandHeader(name: context.state.sandboxName)
            .padding(.leading, 6)
        }
        DynamicIslandExpandedRegion(.trailing) {
          IslandTokens(value: context.state.usage.todayTokens)
            .padding(.trailing, 6)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 10) {
            IslandHero(state: context.state)
            IslandActions(state: context.state)
          }
          .padding(.horizontal, 6)
          .padding(.top, 4)
        }
      } compactLeading: {
        IslandAppIcon(size: 22)
      } compactTrailing: {
        IslandCompactTrailing(state: context.state)
      } minimal: {
        IslandMinimal(state: context.state)
      }
      .widgetURL(context.state.openURL)
      .keylineTint(IslandTheme.keyline)
    }
  }
}

struct IslandLiveItem: Identifiable {
  let id: String
  let title: String
  let startedAt: String?
}

extension IslandAttributes.ContentState {
  var liveItems: [IslandLiveItem] {
    let runs = runningRuns.map { IslandLiveItem(id: $0.id, title: $0.title, startedAt: $0.startedAt) }
    let running = commands
      .filter { $0.state == "running" }
      .map { IslandLiveItem(id: $0.id, title: $0.label, startedAt: nil) }
    return runs + running
  }

  var isLive: Bool {
    !liveItems.isEmpty
  }

  var timerStart: Date? {
    guard let startedAt = liveItems.first(where: { $0.startedAt != nil })?.startedAt else { return nil }
    return IslandFormat.date(startedAt)
  }

  var caption: String {
    let items = liveItems
    if items.count > 1 {
      return "\(items.count) tasks"
    }
    if let item = items.first {
      return item.title
    }
    return usage.runsToday == 1 ? "1 run today" : "\(usage.runsToday) runs today"
  }

  var openURL: URL {
    if let run = runningRuns.first {
      return IslandLinks.run(run.id)
    }
    return IslandLinks.open
  }
}

struct IslandAppIcon: View {
  let size: CGFloat

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
    Image(IslandTheme.appIcon)
      .resizable()
      .scaledToFill()
      .frame(width: size, height: size)
      .clipShape(shape)
      .overlay(shape.strokeBorder(IslandTheme.hairline, lineWidth: 0.5))
  }
}

struct IslandHeader: View {
  let name: String

  var body: some View {
    HStack(spacing: 6) {
      IslandAppIcon(size: 18)
      Text(name)
        .font(IslandFont.medium(12))
        .foregroundStyle(IslandTheme.secondary)
        .lineLimit(1)
    }
  }
}

struct IslandTokens: View {
  let value: Int

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "sparkle")
        .font(.system(size: 10, weight: .semibold))
      Text(IslandFormat.compact(value))
        .font(IslandFont.medium(12))
        .contentTransition(.numericText(value: Double(value)))
    }
    .foregroundStyle(IslandTheme.secondary)
    .lineLimit(1)
    .fixedSize()
  }
}

struct IslandPulse: View {
  let active: Bool

  var body: some View {
    Image(systemName: active ? "waveform" : "moon.zzz")
      .font(.system(size: 20, weight: .semibold))
      .foregroundStyle(active ? IslandTheme.text : IslandTheme.secondary)
      .symbolEffect(.pulse, isActive: active)
      .contentTransition(.symbolEffect(.replace))
      .frame(width: 36, height: 36)
  }
}

struct IslandHero: View {
  let state: IslandAttributes.ContentState
  var size: CGFloat = 28

  var body: some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 0) {
        value
          .font(IslandFont.bold(size))
          .foregroundStyle(IslandTheme.text)
          .lineLimit(1)
          .padding(.vertical, -size * 0.18)
        Text(state.caption)
          .font(IslandFont.regular(11))
          .foregroundStyle(IslandTheme.secondary)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      IslandPulse(active: state.isLive)
    }
  }

  @ViewBuilder
  private var value: some View {
    if let start = state.timerStart {
      Text(start, style: .timer)
        .monospacedDigit()
        .multilineTextAlignment(.leading)
        .transition(.push(from: .bottom))
    } else {
      Text(state.isLive ? "Live" : "Idle")
        .contentTransition(.interpolate)
        .transition(.push(from: .top))
    }
  }
}

struct IslandRoundLink: View {
  let symbol: String
  let destination: URL

  var body: some View {
    Link(destination: destination) {
      Image(systemName: symbol)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(IslandTheme.text)
        .frame(width: 36, height: 36)
        .background(IslandTheme.button, in: Circle())
        .overlay(Circle().strokeBorder(IslandTheme.hairline, lineWidth: 0.5))
    }
  }
}

struct IslandOpenPill: View {
  let destination: URL

  var body: some View {
    Link(destination: destination) {
      HStack(spacing: 6) {
        Text("Open")
          .font(IslandFont.semibold(14))
        Image(systemName: "arrow.up.right")
          .font(.system(size: 11, weight: .bold))
      }
      .foregroundStyle(IslandTheme.background)
      .frame(maxWidth: .infinity)
      .frame(height: 36)
      .background(IslandTheme.text, in: Capsule())
    }
  }
}

struct IslandStopButton: View {
  let id: String

  var body: some View {
    Button(intent: StopRunIntent(runId: id)) {
      Image(systemName: "stop.fill")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(IslandTheme.text)
        .frame(width: 36, height: 36)
        .background(IslandTheme.button, in: Circle())
        .overlay(Circle().strokeBorder(IslandTheme.hairline, lineWidth: 0.5))
    }
    .buttonStyle(.plain)
  }
}

struct IslandActions: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    HStack(spacing: 10) {
      IslandRoundLink(symbol: "camera.viewfinder", destination: IslandLinks.capture)
      IslandOpenPill(destination: state.openURL)
      if let run = state.runningRuns.first {
        IslandStopButton(id: run.id)
          .transition(.scale.combined(with: .opacity))
      }
    }
    .frame(height: 36)
  }
}

struct IslandCompactTrailing: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    if let start = state.timerStart {
      Text(start, style: .timer)
        .font(IslandFont.semibold(12))
        .monospacedDigit()
        .foregroundStyle(IslandTheme.text)
        .multilineTextAlignment(.trailing)
        .frame(width: 46, alignment: .trailing)
    } else if state.isLive {
      HStack(spacing: 4) {
        Image(systemName: "waveform")
          .font(.system(size: 10, weight: .bold))
          .symbolEffect(.pulse)
        Text("\(state.liveItems.count)")
          .font(IslandFont.semibold(12))
          .contentTransition(.numericText(value: Double(state.liveItems.count)))
      }
      .foregroundStyle(IslandTheme.text)
    } else {
      Text(IslandFormat.compact(state.usage.todayTokens))
        .font(IslandFont.medium(12))
        .foregroundStyle(IslandTheme.secondary)
        .contentTransition(.numericText(value: Double(state.usage.todayTokens)))
    }
  }
}

struct IslandMinimal: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    if state.isLive {
      Image(systemName: "waveform")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(IslandTheme.text)
        .symbolEffect(.pulse)
    } else {
      IslandAppIcon(size: 22)
    }
  }
}

struct IslandCardView: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 8) {
        IslandHeader(name: state.sandboxName)
        Spacer(minLength: 8)
        IslandTokens(value: state.usage.todayTokens)
      }
      IslandHero(state: state)
      IslandActions(state: state)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }
}
