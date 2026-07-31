const reviewDialog = document.querySelector("#reviewDialog");
const startReviewButton = document.querySelector("#startReviewButton");
const japaneseWorkspaceButton = document.querySelector("#japaneseWorkspaceButton");

if (reviewDialog && startReviewButton && japaneseWorkspaceButton) {
  reviewDialog.addEventListener("close", () => {
    if (startReviewButton.disabled) {
      japaneseWorkspaceButton.focus();
    }
  });
}
