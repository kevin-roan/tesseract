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
          IslandAppIcon(size: 34)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          IslandTokens(value: context.state.usage.todayTokens)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          IslandTitleBlock(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          IslandLiveRow(state: context.state)
            .padding(.horizontal, 4)
            .padding(.top, 6)
        }
      } compactLeading: {
        IslandAppIcon(size: 22)
      } compactTrailing: {
        IslandCompactTrailing(state: context.state)
      } minimal: {
        IslandAppIcon(size: 22)
      }
      .widgetURL(IslandLinks.open)
      .keylineTint(IslandTheme.keyline)
    }
  }
}

struct IslandLiveItem: Identifiable {
  let id: String
  let title: String
  let project: String?
  let startedAt: String?
}

extension IslandAttributes.ContentState {
  var liveItems: [IslandLiveItem] {
    let runs = runningRuns.map { IslandLiveItem(id: $0.id, title: $0.title, project: $0.project, startedAt: $0.startedAt) }
    let running = commands
      .filter { $0.state == "running" }
      .map { IslandLiveItem(id: $0.id, title: $0.label, project: $0.project, startedAt: nil) }
    return runs + running
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

struct IslandStatusDot: View {
  let active: Bool

  var body: some View {
    Circle()
      .fill(active ? IslandTheme.live : IslandTheme.secondary)
      .frame(width: 6, height: 6)
  }
}

struct IslandStatusLine: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    let count = state.liveItems.count
    HStack(spacing: 5) {
      IslandStatusDot(active: count > 0)
      Text(count > 0 ? "\(count) running" : "Idle")
        .font(.caption2.weight(.medium))
        .foregroundStyle(IslandTheme.secondary)
        .lineLimit(1)
    }
  }
}

struct IslandTitleBlock: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.sandboxName)
        .font(.footnote.weight(.semibold))
        .foregroundStyle(IslandTheme.text)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      IslandStatusLine(state: state)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct IslandTokens: View {
  let value: Int

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      Text(IslandFormat.compact(value))
        .font(.footnote.weight(.semibold))
        .monospacedDigit()
        .foregroundStyle(IslandTheme.text)
      Text("today")
        .font(.caption2)
        .foregroundStyle(IslandTheme.secondary)
    }
    .lineLimit(1)
    .fixedSize()
  }
}

struct IslandElapsed: View {
  let startedAt: String

  var body: some View {
    Text(IslandFormat.date(startedAt), style: .timer)
      .monospacedDigit()
  }
}

struct IslandCompactTrailing: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    let items = state.liveItems
    if items.count == 1, let startedAt = items.first?.startedAt {
      IslandElapsed(startedAt: startedAt)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(IslandTheme.text)
        .multilineTextAlignment(.trailing)
        .frame(width: 42, alignment: .trailing)
    } else {
      HStack(spacing: 4) {
        IslandStatusDot(active: !items.isEmpty)
        Text("\(items.count)")
          .font(.caption2.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(IslandTheme.text)
      }
    }
  }
}

struct IslandIconButton: View {
  let symbol: String
  let destination: URL

  var body: some View {
    Link(destination: destination) {
      Image(systemName: symbol)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(IslandTheme.text)
        .frame(width: 30, height: 30)
        .background(IslandTheme.button, in: Circle())
        .overlay(Circle().strokeBorder(IslandTheme.hairline, lineWidth: 0.5))
    }
  }
}

struct IslandStopButton: View {
  let id: String

  var body: some View {
    Button(intent: StopRunIntent(runId: id)) {
      Image(systemName: "stop.fill")
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(IslandTheme.background)
        .frame(width: 30, height: 30)
        .background(IslandTheme.text, in: Circle())
    }
    .buttonStyle(.plain)
  }
}

struct IslandItemLabel: View {
  let item: IslandLiveItem
  let extra: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(item.title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(IslandTheme.text)
        .lineLimit(1)
      HStack(spacing: 4) {
        if let project = item.project {
          Text(project)
            .lineLimit(1)
        }
        if let startedAt = item.startedAt {
          IslandElapsed(startedAt: startedAt)
            .fixedSize()
        }
        if extra > 0 {
          Text("+\(extra) more")
            .lineLimit(1)
            .fixedSize()
        }
      }
      .font(.caption2)
      .foregroundStyle(IslandTheme.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct IslandLiveRow: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    let items = state.liveItems
    HStack(spacing: 8) {
      if let item = items.first {
        IslandItemLabel(item: item, extra: items.count - 1)
      } else {
        Text("Nothing running")
          .font(.caption.weight(.medium))
          .foregroundStyle(IslandTheme.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      IslandIconButton(symbol: "camera.viewfinder", destination: IslandLinks.capture)
      IslandIconButton(symbol: "arrow.up.right", destination: state.openURL)
      if let item = items.first {
        IslandStopButton(id: item.id)
      }
    }
    .frame(height: 34)
  }
}

struct IslandCardView: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        IslandAppIcon(size: 32)
        IslandTitleBlock(state: state)
        IslandTokens(value: state.usage.todayTokens)
      }
      IslandLiveRow(state: state)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }
}
