"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

const H = "/marketing/figma-hero";

/**
 * Hero “Screen” frame from Figma node I223:76943;223:73053 (Neuros template).
 * Vector SVGs stay sharp at any DPR; layout matches Dev Mode structure.
 */
export function HeroFigmaPanel() {
  return (
    <div
      className="relative h-[300px] w-full shrink-0 overflow-hidden rounded-[24px] border border-[#d2d5e2] bg-[#387ff5] sm:h-[400px] lg:h-[480px]"
      data-name="Screen"
    >
      <div
        className="absolute inset-[-1px] overflow-hidden bg-[#6099f7]"
        data-name="Img lib/Ilustration graph, icon"
      >
        <div
          className="absolute left-[calc(50%-0.08px)] top-[calc(50%-144.36px)] h-[1145.287px] w-[2139.832px] -translate-x-1/2 -translate-y-1/2"
          data-name="Grid"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/grid.svg`} />
        </div>

        <div
          className="absolute left-[calc(50%-41.24px)] top-[calc(50%+0.76px)] size-[185.518px] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-0.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%-42.72px)] top-[calc(50%-1px)] h-[136px] w-[135px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-1.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%-42.9px)] top-[calc(50%-0.9px)] size-[26.503px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-2.svg`} />
        </div>

        <div
          className="absolute left-[calc(50%+64.5px)] top-[calc(50%-116.5px)] size-[55px] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-3.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%+63.88px)] top-[calc(50%-117.13px)] size-[35px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-4.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%+63.88px)] top-[calc(50%-117.13px)] size-[17.5px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-5.svg`} />
        </div>

        <div
          className="absolute left-[calc(50%-150.5px)] top-[calc(50%+158.5px)] size-[129px] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-6.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%-151.74px)] top-[calc(50%+157.26px)] size-[69.462px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-7.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%-151.74px)] top-[calc(50%+157.26px)] size-[34.731px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-8.svg`} />
        </div>

        <div
          className="absolute left-[calc(50%-550px)] top-[calc(50%-192px)] size-[352px] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-9.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%-553.38px)] top-[calc(50%-195.38px)] size-[189.538px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-10.svg`} />
        </div>

        <div
          className="absolute left-[calc(50%+564px)] top-[calc(50%+240px)] size-[472px] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-11.svg`} />
        </div>
        <div
          className="absolute left-[calc(50%+559.46px)] top-[calc(50%+235.46px)] size-[254.154px] -translate-x-1/2 -translate-y-1/2"
          data-name="Ellipse"
        >
          <img alt="" className="block size-full max-w-none" src={`${H}/ellipse-12.svg`} />
        </div>

        <div
          className="pointer-events-none absolute inset-0 mix-blend-color-burn bg-[rgba(56,127,245,0.1)]"
          data-name="Theme color overlay transition"
        />
      </div>

      <Link
        href="/product"
        className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-[48px] border-[12px] border-solid border-[rgba(195,209,255,0.35)] bg-white py-3 pl-3 pr-6 backdrop-blur-[6px] transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        data-name="Auto Layout Horizontal"
      >
        <div className="relative size-[60px] shrink-0 overflow-hidden" data-name="Button">
          <div className="absolute left-[3.5px] top-[4px] size-[53px]" data-name="Icon/Play">
            <img alt="" className="block size-full max-w-none object-contain" src={`${H}/play.svg`} />
          </div>
        </div>
        <div className="flex flex-col items-start justify-center" data-name="Content">
          <p className="whitespace-nowrap text-[20px] font-semibold leading-[1.58] text-[#1c1f25]">
            Watch introduce video
          </p>
          <div className="flex items-center gap-2">
            <span className="text-base font-normal leading-relaxed text-[#4b5162] opacity-80">
              5 mins
            </span>
            <span className="relative size-1 shrink-0">
              <img alt="" className="block size-full max-w-none" src={`${H}/dot.svg`} />
            </span>
            <span className="text-base font-medium leading-relaxed text-[#387ff5]">Play video</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
