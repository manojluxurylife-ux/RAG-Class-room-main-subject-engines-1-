export const getCloudHealth = async () => {
  return {
    status: "ok",
    storage: "local-json",
    message: "Using local JSON store for persistence.",
  };
};
