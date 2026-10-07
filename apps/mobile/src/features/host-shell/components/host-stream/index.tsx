import { useMemo } from "react";
import { View } from "react-native";

import { ListGroup, ListRow, ListStepperRow } from "@/components/list-group";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { HostStreamState } from "../../hooks/use-host-stream";
import { STREAM_COPY } from "../../utils/content";
import createStyles from "./styles";

export type HostStreamProps = {
  stream: HostStreamState;
};

const steps = { decreaseLabel: STREAM_COPY.decrease, increaseLabel: STREAM_COPY.increase };

const HostStream = ({ stream }: HostStreamProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.stack} testID="host-stream">
      {stream.error ? <Notice tone="danger" message={stream.error} actionLabel={STREAM_COPY.retry} onAction={stream.refresh} /> : null}
      {stream.saved ? <Notice tone="success" message={STREAM_COPY.saved} /> : null}
      {stream.ready ? (
        <>
          <ListGroup title={STREAM_COPY.deviceGroup} dividerInset="text">
            <ListRow
              label={STREAM_COPY.device}
              detail={STREAM_COPY.deviceDetail}
              value={stream.device.label}
              chevron
              onPress={stream.device.open}
              testID="stream-device"
            />
          </ListGroup>
          <ListGroup title={STREAM_COPY.videoGroup} footnote={STREAM_COPY.videoFootnote} dividerInset="text">
            <ListRow
              label={STREAM_COPY.encoding}
              detail={STREAM_COPY.encodingDetail}
              value={stream.encoding.label}
              chevron
              onPress={stream.encoding.open}
              testID="stream-encoding"
            />
            <ListStepperRow label={STREAM_COPY.bitRate} detail={STREAM_COPY.bitRateDetail} {...stream.bitRate} {...steps} />
            <ListStepperRow label={STREAM_COPY.maxFps} detail={STREAM_COPY.maxFpsDetail} {...stream.maxFps} {...steps} />
            <ListRow
              label={STREAM_COPY.maxSize}
              detail={STREAM_COPY.maxSizeDetail}
              value={stream.maxSize.label}
              chevron
              onPress={stream.maxSize.open}
              testID="stream-max-size"
            />
            <ListStepperRow
              label={STREAM_COPY.keyFrameInterval}
              detail={STREAM_COPY.keyFrameIntervalDetail}
              {...stream.keyFrameInterval}
              {...steps}
            />
            <ListStepperRow label={STREAM_COPY.jpegQuality} detail={STREAM_COPY.jpegQualityDetail} {...stream.jpegQuality} {...steps} />
          </ListGroup>
        </>
      ) : null}
      <OptionSheet
        visible={stream.sheet.visible}
        title={stream.sheet.title}
        options={stream.sheet.options}
        selectedId={stream.sheet.selectedId}
        onSelect={stream.sheet.select}
        onClose={stream.sheet.close}
        footnote={stream.sheet.footnote}
      />
    </View>
  );
};

export default HostStream;
