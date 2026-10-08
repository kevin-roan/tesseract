import { useState } from "react";
import { HammerIcon } from "phosphor-react-native";
import type { BuildProfile } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import ChoiceGroup from "@/components/choice-group";
import ResourceCard from "@/components/resource-card";

import type { BuildTargetOption } from "../../types";
import { BUILD_PROFILE_OPTIONS, isBuildProfile } from "../../utils/labels";

export type BuildTargetCardProps = {
  option: BuildTargetOption;
  onBuild: (profile: BuildProfile) => void;
  building?: boolean;
};

const BuildTargetCard = ({ option, onBuild, building = false }: BuildTargetCardProps) => {
  const [profile, setProfile] = useState<BuildProfile>("debug");

  return (
    <ResourceCard
      icon={HammerIcon}
      title={option.label}
      subtitle={option.platform}
      footer={
        <>
          <ChoiceGroup
            options={BUILD_PROFILE_OPTIONS}
            selectedId={profile}
            onSelect={(id) => isBuildProfile(id) && setProfile(id)}
            label="Build profile"
          />
          <ActionButton
            label="Build"
            icon={HammerIcon}
            size="sm"
            loading={building}
            onPress={() => onBuild(profile)}
            accessibilityLabel={`Build ${option.label}`}
          />
        </>
      }
    />
  );
};

export default BuildTargetCard;
