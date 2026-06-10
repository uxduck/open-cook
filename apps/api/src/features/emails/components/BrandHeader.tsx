import { Section, Text } from "react-email";
import { kitchen } from "./EmailLayout";

export function BrandHeader() {
  return (
    <Section className="mb-10">
      <table
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: kitchen.primary,
                borderRadius: "8px",
                fontSize: "18px",
                height: "32px",
                lineHeight: "32px",
                textAlign: "center",
                verticalAlign: "middle",
                width: "32px",
              }}
            >
              🍳
            </td>
            <td style={{ verticalAlign: "middle", paddingLeft: "10px" }}>
              <Text
                style={{ color: kitchen.foreground, margin: 0 }}
                className="text-xl font-bold tracking-tight"
              >
                OpenCook
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
