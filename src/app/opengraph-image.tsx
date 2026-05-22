import { ImageResponse } from "next/og";
import { getCrcBoostPublicUrl } from "@/lib/public-url";

export const runtime = "edge";
export const alt = "CRC Boosts by NF-Society";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpengraphImage() {
  const baseUrl = getCrcBoostPublicUrl();

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          backgroundColor: "#080711",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <img
          src={`${baseUrl}/crc-boost-bg-dark.png`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            height: "100%",
            width: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(7, 7, 18, 0.92) 0%, rgba(20, 13, 52, 0.78) 48%, rgba(255, 72, 36, 0.18) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 58,
            top: 52,
            right: 58,
            bottom: 52,
            display: "flex",
            flexDirection: "column",
            borderRadius: 34,
            border: "2px solid rgba(255, 255, 255, 0.16)",
            background: "rgba(8, 9, 21, 0.76)",
            boxShadow: "0 28px 90px rgba(0, 0, 0, 0.42)",
            padding: 42,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img
              src={`${baseUrl}/crc-boost-icon.png`}
              alt=""
              style={{
                height: 72,
                width: 72,
                borderRadius: 20,
                border: "2px solid rgba(255, 255, 255, 0.22)",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: 5,
                  textTransform: "uppercase",
                }}
              >
                CRC Boost Market
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "rgba(255, 255, 255, 0.72)",
                }}
              >
                by NF-Society
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "fit-content",
              borderRadius: 999,
              background: "rgba(255, 71, 38, 0.16)",
              padding: "10px 18px",
              color: "#ff6b48",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginTop: 48,
            }}
          >
            Verified X Attention
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 0.96,
              letterSpacing: -2,
              maxWidth: 820,
            }}
          >
            Fund X campaigns. Pay users in CRC.
          </div>
          <div
            style={{
              marginTop: 24,
              color: "rgba(255, 255, 255, 0.78)",
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.35,
              maxWidth: 810,
            }}
          >
            Projects fund a reward pool. Users complete verified X actions and earn on-chain CRC after settlement.
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {["X verified", "Circles trust", "CRC payout"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    borderRadius: 14,
                    border: "1px solid rgba(133, 246, 199, 0.34)",
                    background: "rgba(19, 92, 66, 0.34)",
                    padding: "13px 17px",
                    color: "#d8fff0",
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.92)",
                color: "#15141a",
                padding: "13px 20px",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              Built on Circles
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
