import React from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

import { colors } from '../../theme/colors';

const PageWrapper = styled.div`
  background: ${colors.bg};
  min-height: 100vh;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const HeroSection = styled.section`
  position: relative;
  width: 100%;
  height: 100vh;
  min-height: 700px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeroVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const HeroOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      ellipse 80% 80% at 50% 50%,
      rgba(0, 0, 0, 0.15) 0%,
      rgba(0, 0, 0, 0.5) 60%,
      rgba(0, 0, 0, 0.85) 100%
    ),
    linear-gradient(
      to bottom,
      transparent 0%,
      transparent 60%,
      rgba(0, 0, 0, 0.3) 100%
    );
  z-index: 1;
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 900px;
`;

const HeroTitle = styled(motion.h1)`
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: clamp(56px, 9vw, 120px);
  font-weight: 400;
  color: #FFFFFF;
  line-height: 1.05;
  margin: 0 0 24px 0;
  letter-spacing: -0.02em;
`;

const HeroSubtitle = styled(motion.p)`
  font-size: clamp(16px, 2vw, 20px);
  color: rgba(255, 255, 255, 0.75);
  margin: 0 0 48px 0;
  font-weight: 300;
  letter-spacing: 0.02em;
`;

const HeroCTA = styled(motion.a)`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #FFFFFF;
  text-decoration: none;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  position: relative;
  padding-bottom: 8px;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: #FFFFFF;
    transform-origin: right;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &:hover::after {
    transform-origin: left;
    transform: scaleX(0);
  }
`;

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&family=JetBrains+Mono:wght@400&family=Cabinet+Grotesk:wght@400;500;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html {
            scroll-behavior: smooth;
          }

          ::selection {
            background: ${colors.highlight};
            color: #FFFFFF;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: ${colors.bg};
          }

          ::-webkit-scrollbar-thumb {
            background: ${colors.border};
          }

          @media (max-width: 768px) {
            ${HeroContent} {
              padding: 0 24px;
            }
          }
        `}
      </style>

      <HeroSection>
        <HeroVideo
          autoPlay
          muted
          loop
          playsInline
          poster="https://picsum.photos/seed/hero-recruit/1920/1080"
        >
          <source src="/hero-recruit.mp4" type="video/mp4" />
        </HeroVideo>
        <HeroOverlay />
        <HeroContent>
          <HeroTitle
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 500, letterSpacing: '-0.03em' }}
          >
            Link & Sense
          </HeroTitle>
          <HeroSubtitle
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          >
            重新定义人才评估，让每一次对话都成为精准的人才匹配
          </HeroSubtitle>
          <HeroCTA
            href="#"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}
          >
            登  录 →
          </HeroCTA>
        </HeroContent>
      </HeroSection>
    </PageWrapper>
  );
};

export default HomePage;
