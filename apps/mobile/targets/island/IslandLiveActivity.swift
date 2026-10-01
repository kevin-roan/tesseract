import ActivityKit
import SwiftUI
import WidgetKit

struct IslandLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: IslandAttributes.self) { context in
      IslandCardView(state: context.state)
        .activityBackgroundTint(IslandTheme.background)
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandExpandedLeading(state: context.state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          IslandExpandedTrailing(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          IslandExpandedBottom(state: context.state)
        }
      } compactLeading: {
        IslandGlyph()
      } compactTrailing: {
        IslandCompactTrailing(state: context.state)
      } minimal: {
        IslandGlyph()
      }
      .widgetURL(IslandLinks.open)
      .keylineTint(IslandTheme.accent)
    }
  }
}

struct IslandGlyph: View {
  var body: some View {
    Image(systemName: IslandTheme.glyph)
      .font(.system(size: 14, weight: .semibold))
      .foregroundStyle(IslandTheme.accent)
  }
}

struct IslandStatusDot: View {
  let active: Bool

  var body: some View {
    Circle()
      .fill(active ? IslandTheme.accent : IslandTheme.muted)
      .frame(width: 8, height: 8)
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
    let running = state.runningRuns
    if running.count == 1, let run = running.first {
      IslandElapsed(startedAt: run.startedAt)
        .font(.caption2.weight(.semibold))
        .multilineTextAlignment(.trailing)
        .frame(minWidth: 40)
    } else {
      Text("\(running.count)")
        .font(.caption2.weight(.semibold))
    }
  }
}

struct IslandRunHeadline: View {
  let run: IslandAttributes.IslandRun
  var showsTimer = true

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(run.title)
        .font(.subheadline.weight(.bold))
        .lineLimit(1)
      HStack(spacing: 6) {
        if let project = run.project {
          Text(project)
            .lineLimit(1)
        }
        if showsTimer {
          IslandElapsed(startedAt: run.startedAt)
        }
      }
      .font(.caption)
      .foregroundStyle(IslandTheme.muted)
    }
  }
}

struct IslandUsageFigure: View {
  let label: String
  let value: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(IslandFormat.compact(value))
        .font(.footnote.weight(.semibold))
        .monospacedDigit()
      Text(label)
        .font(.caption2)
        .foregroundStyle(IslandTheme.muted)
    }
  }
}

struct IslandUsageRow: View {
  let usage: IslandAttributes.IslandUsage

  var body: some View {
    HStack(spacing: 16) {
      IslandUsageFigure(label: "today", value: usage.todayTokens)
      IslandUsageFigure(label: "week", value: usage.weekTokens)
      IslandUsageFigure(label: "runs", value: usage.runsToday)
    }
  }
}

struct IslandStopButton: View {
  let runId: String

  var body: some View {
    Button(intent: StopRunIntent(runId: runId)) {
      Image(systemName: "stop.fill")
        .font(.caption.weight(.bold))
        .padding(6)
    }
    .buttonStyle(.plain)
    .foregroundStyle(.white)
    .background(Color.white.opacity(0.15), in: Circle())
  }
}

struct IslandLinkButton: View {
  let title: String
  let symbol: String
  let destination: URL

  var body: some View {
    Link(destination: destination) {
      Label(title, systemImage: symbol)
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.15), in: Capsule())
    }
    .foregroundStyle(.white)
  }
}

struct IslandActionRow: View {
  let state: IslandAttributes.ContentState
  var showsStop = true

  var body: some View {
    HStack(spacing: 8) {
      IslandLinkButton(title: "Capture", symbol: "camera.viewfinder", destination: IslandLinks.capture)
      IslandLinkButton(title: "Open", symbol: "arrow.up.right", destination: openDestination)
      Spacer()
      if showsStop, let run = state.runningRuns.first {
        IslandStopButton(runId: run.id)
      }
    }
  }

  private var openDestination: URL {
    if let run = state.runningRuns.first {
      return IslandLinks.run(run.id)
    }
    return IslandLinks.open
  }
}

struct IslandCardView: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    let running = state.runningRuns
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        IslandGlyph()
        Text(state.sandboxName)
          .font(.footnote.weight(.semibold))
          .lineLimit(1)
        Spacer()
        IslandStatusDot(active: !running.isEmpty)
      }
      if let run = running.first {
        IslandRunHeadline(run: run)
      } else {
        Text("Idle")
          .font(.subheadline.weight(.bold))
          .foregroundStyle(IslandTheme.muted)
      }
      IslandUsageRow(usage: state.usage)
      IslandActionRow(state: state)
    }
    .padding(14)
    .foregroundStyle(.white)
  }
}

struct IslandExpandedLeading: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    if let run = state.runningRuns.first {
      IslandRunHeadline(run: run, showsTimer: false)
    } else {
      VStack(alignment: .leading, spacing: 2) {
        Text(state.sandboxName)
          .font(.subheadline.weight(.bold))
          .lineLimit(1)
        Text("Idle")
          .font(.caption)
          .foregroundStyle(IslandTheme.muted)
      }
    }
  }
}

struct IslandExpandedTrailing: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      Text(IslandFormat.compact(state.usage.todayTokens))
        .font(.subheadline.weight(.bold))
        .monospacedDigit()
      Text("tokens today")
        .font(.caption2)
        .foregroundStyle(IslandTheme.muted)
    }
  }
}

struct IslandExpandedBottom: View {
  let state: IslandAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(rows.prefix(3), id: \.id) { row in
        HStack(spacing: 8) {
          VStack(alignment: .leading, spacing: 0) {
            Text(row.title)
              .font(.caption.weight(.semibold))
              .lineLimit(1)
            if let project = row.project {
              Text(project)
                .font(.caption2)
                .foregroundStyle(IslandTheme.muted)
                .lineLimit(1)
            }
          }
          Spacer()
          if let startedAt = row.startedAt {
            IslandElapsed(startedAt: startedAt)
              .font(.caption2)
              .foregroundStyle(IslandTheme.muted)
          }
          IslandStopButton(runId: row.id)
        }
      }
      IslandActionRow(state: state, showsStop: false)
    }
    .foregroundStyle(.white)
  }

  private struct Row: Identifiable {
    let id: String
    let title: String
    let project: String?
    let startedAt: String?
  }

  private var rows: [Row] {
    let runs = state.runningRuns.map { Row(id: $0.id, title: $0.title, project: $0.project, startedAt: $0.startedAt) }
    let commands = state.commands
      .filter { $0.state == "running" }
      .map { Row(id: $0.id, title: $0.label, project: $0.project, startedAt: nil) }
    return runs + commands
  }
}
