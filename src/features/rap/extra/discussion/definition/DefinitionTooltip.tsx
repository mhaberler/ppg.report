import { useState } from "react";
import { DefinitionTooltipProps, definitionStyles } from "./Definition";
import {
  offset,
  shift,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import styled from "@emotion/styled";

export const TooltipContainer = styled.div`
  z-index: 1000;
  background: black;
  font-size: 0.8em;
  max-width: 450px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  white-space: normal;
`;

const DefinitionLink = styled.a`
  && {
    ${() => definitionStyles}
  }
`;

export default function DefinitionTooltip({
  term,
  definition,
  children,
}: DefinitionTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [shift(), offset(5)],
  });

  const hover = useHover(context, {
    delay: {
      open: 100,
      close: 0,
    },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  const href = `https://forecast.weather.gov/glossary.php?word=${term}`;

  return (
    <>
      <DefinitionLink
        ref={refs.setReference}
        {...getReferenceProps()}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          window.open(
            href,
            "noaaDefinitions",
            "toolbar=no,location=yes,status=no,menubar=no,scrollbars=yes,resizable=yes,width=540,height=540"
          );
          e.preventDefault();
        }}
      >
        {children}
      </DefinitionLink>
      {isOpen && (
        <TooltipContainer
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          dangerouslySetInnerHTML={{ __html: definition }}
        />
      )}
    </>
  );
}
