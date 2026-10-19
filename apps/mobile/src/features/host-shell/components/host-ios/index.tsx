import ActionButton from "@/components/action-button";
import Chip from "@/components/chip";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import ResourceCard from "@/components/resource-card";
import Section from "@/components/section";
import { ThemedText } from "@/components/themed-text";

import type { HostIosState } from "../../hooks/use-host-ios";
import { IOS_COPY, IOS_ICONS } from "../../utils/content";
import { simMeta, simStateLabel, simTone } from "../../utils/ios";

export type HostIosProps = {
  ios: HostIosState;
};

const HostIos = ({ ios }: HostIosProps) => {
  const { status, device } = ios;
  const live = ios.canShutdown || ios.canKill;

  return (
    <Section title={IOS_COPY.title} loading={ios.loading} testID="host-ios">
      {ios.error ? <Notice tone="danger" message={ios.error} actionLabel={IOS_COPY.retry} onAction={ios.refresh} /> : null}
      {ios.unavailable ? <Notice tone="warning" title={ios.unavailable.title} message={ios.unavailable.message} /> : null}
      {status?.available ? (
        <ResourceCard
          icon={IOS_ICONS.simulator}
          title={device?.name ?? IOS_COPY.noDevice}
          subtitle={[IOS_COPY.simulator, status.xcode].filter(Boolean).join(" · ")}
          meta={device ? simMeta(device) : undefined}
          badge={device ? { label: simStateLabel(device.state), tone: simTone(device.state) } : undefined}
          footer={
            <>
              <Chip
                label={device?.name ?? IOS_COPY.noDevice}
                icon={IOS_ICONS.device}
                variant="ghost"
                disabled={ios.devicePicker.options.length === 0}
                onPress={ios.devicePicker.open}
              />
              {live ? null : (
                <ActionButton
                  label={IOS_COPY.boot}
                  icon={IOS_ICONS.boot}
                  size="sm"
                  loading={ios.booting}
                  disabled={!ios.canBoot}
                  onPress={ios.boot}
                  testID="host-ios-boot"
                />
              )}
              {ios.canShutdown ? (
                <ActionButton
                  label={IOS_COPY.shutdown}
                  icon={IOS_ICONS.shutdown}
                  variant="danger"
                  size="sm"
                  loading={ios.shuttingDown}
                  onPress={ios.shutdown}
                  testID="host-ios-shutdown"
                />
              ) : null}
              {ios.canKill ? (
                <ActionButton
                  label={IOS_COPY.forceKill}
                  icon={IOS_ICONS.forceKill}
                  variant="danger"
                  size="sm"
                  loading={ios.killing}
                  onPress={ios.kill}
                  testID="host-ios-kill"
                />
              ) : null}
              {ios.canOpen ? (
                <ActionButton
                  label={IOS_COPY.openScreen}
                  icon={IOS_ICONS.open}
                  variant="secondary"
                  size="sm"
                  onPress={ios.openScreen}
                  testID="host-ios-open"
                />
              ) : null}
            </>
          }
        >
          {device?.error ? (
            <ThemedText variant="caption" color="danger" selectable>
              {device.error}
            </ThemedText>
          ) : null}
          {ios.blocked ? (
            <ThemedText variant="caption" color="textTertiary">
              {ios.blocked}
            </ThemedText>
          ) : null}
          {device ? null : (
            <ThemedText variant="caption" color="textTertiary">
              {IOS_COPY.noDevices}
            </ThemedText>
          )}
        </ResourceCard>
      ) : null}
      <OptionSheet
        visible={ios.devicePicker.visible}
        title={IOS_COPY.deviceSheetTitle}
        options={ios.devicePicker.options}
        selectedId={device?.udid ?? null}
        onSelect={ios.devicePicker.select}
        onClose={ios.devicePicker.close}
        footnote={IOS_COPY.deviceFootnote}
      />
    </Section>
  );
};

export default HostIos;
