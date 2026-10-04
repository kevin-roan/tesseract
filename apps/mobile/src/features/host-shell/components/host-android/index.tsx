import ActionButton from "@/components/action-button";
import Chip from "@/components/chip";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import ResourceCard from "@/components/resource-card";
import Section from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { stateLabel } from "@/features/sandbox/utils/states";

import type { HostAndroidState } from "../../hooks/use-host-android";
import { emulatorMeta, emulatorTone, linkBadge } from "../../utils/android";
import { ANDROID_COPY, ANDROID_ICONS } from "../../utils/content";

export type HostAndroidProps = {
  android: HostAndroidState;
};

const HostAndroid = ({ android }: HostAndroidProps) => {
  const { status } = android;
  const emulator = status?.emulator;
  const link = status?.link;

  return (
    <Section title={ANDROID_COPY.title} loading={android.loading} testID="host-android">
      {android.error ? (
        <Notice tone="danger" message={android.error} actionLabel={ANDROID_COPY.retry} onAction={android.refresh} />
      ) : null}
      {status && !status.available ? <Notice tone="warning" message={status.reason ?? ANDROID_COPY.unavailable} /> : null}
      {android.isolationNotice ? (
        <Notice tone="warning" title={android.isolationNotice.title} message={android.isolationNotice.message} />
      ) : null}
      {status && emulator ? (
        <ResourceCard
          icon={ANDROID_ICONS.emulator}
          title={emulator.avd ?? android.avd ?? ANDROID_COPY.noAvd}
          subtitle={ANDROID_COPY.emulator}
          meta={emulatorMeta(emulator)}
          badge={{ label: stateLabel(emulator.state), tone: emulatorTone(emulator.state) }}
          footer={
            <>
              {android.canStop ? null : (
                <Chip
                  label={android.avd ?? ANDROID_COPY.noAvd}
                  icon={ANDROID_ICONS.emulator}
                  variant="ghost"
                  disabled={!status.available || android.avdPicker.options.length === 0}
                  onPress={android.avdPicker.open}
                />
              )}
              {android.canStop ? (
                <ActionButton
                  label={ANDROID_COPY.stop}
                  icon={ANDROID_ICONS.stop}
                  variant="danger"
                  size="sm"
                  loading={android.stopping}
                  onPress={android.stop}
                />
              ) : (
                <ActionButton
                  label={ANDROID_COPY.start}
                  icon={ANDROID_ICONS.start}
                  size="sm"
                  loading={android.starting}
                  disabled={!android.canStart}
                  onPress={android.start}
                />
              )}
              {android.canOpen ? (
                <ActionButton
                  label={ANDROID_COPY.openScreen}
                  icon={ANDROID_ICONS.open}
                  variant="secondary"
                  size="sm"
                  onPress={android.openScreen}
                />
              ) : null}
            </>
          }
        >
          {emulator.error ? (
            <ThemedText variant="caption" color="danger" selectable>
              {emulator.error}
            </ThemedText>
          ) : null}
        </ResourceCard>
      ) : null}
      {status && link ? (
        <ResourceCard
          icon={ANDROID_ICONS.link}
          title={ANDROID_COPY.linkTitle}
          subtitle={link.sandboxUrl ?? ANDROID_COPY.notLinked}
          monospaceSubtitle={link.sandboxUrl !== null}
          badge={linkBadge(link)}
          footer={
            <>
              {android.linkedToActive ? null : (
                <ActionButton
                  label={android.sandboxName ? `${ANDROID_COPY.link}: ${android.sandboxName}` : ANDROID_COPY.link}
                  icon={ANDROID_ICONS.link}
                  size="sm"
                  loading={android.linking}
                  disabled={!android.canLink || android.linkBlocked !== null}
                  onPress={android.link}
                />
              )}
              {link.configured ? (
                <ActionButton
                  label={ANDROID_COPY.unlink}
                  icon={ANDROID_ICONS.unlink}
                  variant="secondary"
                  size="sm"
                  loading={android.unlinking}
                  onPress={android.unlink}
                />
              ) : null}
            </>
          }
        >
          <ThemedText variant="caption" color={link.lastError ? "danger" : "textTertiary"} selectable>
            {link.lastError ?? android.linkBlocked ?? (android.canLink ? ANDROID_COPY.linkMessage : ANDROID_COPY.noSandbox)}
          </ThemedText>
        </ResourceCard>
      ) : null}
      <OptionSheet
        visible={android.avdPicker.visible}
        title={ANDROID_COPY.avdSheetTitle}
        options={android.avdPicker.options}
        selectedId={android.avd}
        onSelect={android.avdPicker.select}
        onClose={android.avdPicker.close}
        footnote={ANDROID_COPY.avdFootnote}
      />
    </Section>
  );
};

export default HostAndroid;
