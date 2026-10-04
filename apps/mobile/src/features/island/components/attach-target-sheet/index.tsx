import { useMemo } from "react";
import { ScrollView } from "react-native";
import { ChatCircleIcon, ClockCounterClockwiseIcon, FolderSimpleIcon } from "phosphor-react-native";

import BottomSheet from "@/components/bottom-sheet";
import { ListGroup } from "@/components/list-group";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useAttachTarget } from "../../hooks/use-attach-target";
import DestinationRow from "../destination-row";
import DraftPreview from "../draft-preview";
import createStyles from "./styles";

/** Where a captured or shared draft should land: the Home composer, a project's new run, or a recent chat. */
const AttachTargetSheet = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const target = useAttachTarget();

  return (
    <BottomSheet visible={target.visible} title="Attach to" onClose={target.close} testID="attach-target-sheet">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {target.draft ? <DraftPreview draft={target.draft} /> : null}
        <ListGroup dividerInset="text">
          <DestinationRow
            label={target.newChat.label}
            detail={target.newChat.detail}
            icon={ChatCircleIcon}
            onPress={() => target.select(target.newChat)}
            testID="attach-new-chat"
          />
        </ListGroup>
        {target.projects.length > 0 ? (
          <ListGroup title="Projects" dividerInset="text">
            {target.projects.map((destination, index) => (
              <DestinationRow
                key={destination.id}
                index={index + 1}
                label={destination.label}
                detail={destination.detail}
                icon={FolderSimpleIcon}
                onPress={() => target.select(destination)}
                testID={`attach-project-${destination.id}`}
              />
            ))}
          </ListGroup>
        ) : null}
        {target.chats.length > 0 ? (
          <ListGroup title="Recent chats" dividerInset="text">
            {target.chats.map((destination, index) => (
              <DestinationRow
                key={destination.id}
                index={index + 1 + target.projects.length}
                label={destination.label}
                detail={destination.detail}
                icon={ClockCounterClockwiseIcon}
                onPress={() => target.select(destination)}
                testID={`attach-chat-${destination.id}`}
              />
            ))}
          </ListGroup>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
};

export default AttachTargetSheet;
