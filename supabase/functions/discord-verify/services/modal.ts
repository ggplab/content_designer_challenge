export function buildModal(isPublic: boolean) {
  const fields = [
    { id: "link1", label: "링크 1 (필수)", required: true },
    { id: "link2", label: "링크 2", required: false },
    { id: "link3", label: "링크 3", required: false },
    { id: "link4", label: "링크 4", required: false },
    { id: "link5", label: "링크 5", required: false },
  ];

  return {
    type: 9,
    data: {
      custom_id: `verify_modal:${isPublic ? "public" : "private"}`,
      title: "콘텐츠 인증",
      components: fields.map(({ id, label, required }) => ({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: id,
            label,
            style: 1,
            placeholder: "https://...",
            required,
            max_length: 500,
          },
        ],
      })),
    },
  };
}
