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

  /// Index of the task the previous / next buttons switched to, falling back to the newest one.
  var focusIndex: Int {
    let items = liveItems
    guard let id = focusId ?? IslandContract.focusId,
          let index = items.firstIndex(where: { $0.id == id }) else { return 0 }
    return index
  }

  var focused: IslandLiveItem? {
    let items = liveItems
    return items.isEmpty ? nil : items[focusIndex]
  }

  func neighbor(_ step: Int) -> IslandLiveItem? {
    let items = liveItems
    guard items.count > 1 else { return nil }
    return items[(focusIndex + step + items.count) % items.count]
  }

  var timerStart: Date? {
    guard let startedAt = focused?.startedAt else { return nil }
    return IslandFormat.date(startedAt)
  }

  var caption: String {
    if let item = focused {
      return item.title
    }
    return usage.runsToday == 1 ? "1 run today" : "\(usage.runsToday) runs today"
  }

  var openURL: URL {
    if let item = focused, runningRuns.contains(where: { $0.id == item.id }) {
      return IslandLinks.run(item.id)
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
      if let previous = state.neighbor(-1), let next = state.neighbor(1) {
        IslandPager(previous: previous.id, next: next.id, index: state.focusIndex, count: state.liveItems.count)
      } else {
        IslandPulse(active: state.isLive)
      }
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

struct IslandPager: View {
  let previous: String
  let next: String
  let index: Int
  let count: Int

  var body: some View {
    HStack(spacing: 6) {
      IslandStepButton(symbol: "chevron.left", taskId: previous)
      Text("\(index + 1)/\(count)")
        .font(IslandFont.semibold(12))
        .monospacedDigit()
        .foregroundStyle(IslandTheme.secondary)
        .contentTransition(.numericText(value: Double(index)))
        .fixedSize()
      IslandStepButton(symbol: "chevron.right", taskId: next)
    }
  }
}

struct IslandStepButton: View {
  let symbol: String
  let taskId: String

  var body: some View {
    Button(intent: ShowTaskIntent(taskId: taskId)) {
      Image(systemName: symbol)
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(IslandTheme.text)
        .frame(width: 30, height: 30)
        .background(IslandTheme.button, in: Circle())
        .overlay(Circle().strokeBorder(IslandTheme.hairline, lineWidth: 0.5))
    }
    .buttonStyle(.plain)
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
      if let item = state.focused {
        IslandStopButton(id: item.id)
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
