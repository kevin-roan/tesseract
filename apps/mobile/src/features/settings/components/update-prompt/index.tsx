import { useUpdatePrompt } from "../../hooks/use-update-prompt";
import UpdateSheet from "../update-sheet";

const UpdatePrompt = () => {
  const prompt = useUpdatePrompt();

  return (
    <UpdateSheet
      visible={prompt.visible}
      title={prompt.title}
      message={prompt.message}
      detail={prompt.detail}
      installLabel={prompt.installLabel}
      laterLabel={prompt.laterLabel}
      installing={prompt.installing}
      error={prompt.error}
      errorTitle={prompt.errorTitle}
      onInstall={prompt.install}
      onClose={prompt.dismiss}
    />
  );
};

export default UpdatePrompt;
