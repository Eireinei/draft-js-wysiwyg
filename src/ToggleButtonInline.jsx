import React, { useContext } from 'react';
import { ToggleButton } from '@material-ui/lab';
import EditorContext from './EditorContext';
import { RichUtils, EditorState } from 'draft-js';

export const ToggleButtonInline = ({
    value,
    selected,
    children,
    ...rest
}) => {
    const { editorState, setEditorState } = useContext(EditorContext);

    // Synchronize selection with keyboard shortcuts
    const checkSelected = () => {
        if (editorState.getCurrentContent().hasText()) {
            const hasValue = editorState
                .getCurrentInlineStyle()
                .has(value);

            return (hasValue && !selected) || (!hasValue && selected)
                ? !selected
                : selected;
        } else {
            return selected;
        }
    }

    const handleClick = (e) => {
        if (editorState && setEditorState) {
            const editorStateFocused = EditorState.forceSelection(
                editorState,
                editorState.getSelection(),
            );
            setEditorState(RichUtils.toggleInlineStyle(editorStateFocused, value));
        }
    }

    return (
        <ToggleButton
            onClick={handleClick}
            selected={checkSelected()}
            value={value}
            {...rest}
        >
            {children}
        </ToggleButton>
    );
};
