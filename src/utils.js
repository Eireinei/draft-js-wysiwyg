import {
    EditorState,
    Modifier,
    ContentBlock,
    BlockMapBuilder,
    ContentState,
} from 'draft-js';

/**
 * 
 */
export const getBlockDataForKey = (contentState, blockKey) => {
    return contentState
        .getBlockForKey(blockKey)
        ?.getData();
}

/**
 * Returns collection of blocks.
 */
export function getBlocksMapBetween(blockMap, startKey, endKey) {
    return blockMap
        .toSeq()
        .skipUntil((_, k) => k === startKey)
        .takeUntil((_, k) => k === endKey)
        .concat([[endKey, blockMap.get(endKey)]]);
}

/**
 * Returns array of blocks.
 */
export function getBlocksBetween(contentState, startKey, endKey) {
    return getBlocksMapBetween(
        contentState.getBlockMap(),
        startKey,
        endKey
    ).toArray();
}

/**
 * Returns array keys of blocks.
 */
export function getBlocksKeysBetween(contentState, startKey, endKey) {
    return getBlocksMapBetween(
        contentState.getBlockMap(),
        startKey,
        endKey
    ).toArray().map(contentBlock => contentBlock.getKey());
}

/**
 * Add block level meta-data.
 */
export const setBlockData = (editorState, blockData) => {
    return EditorState.push(
        editorState,
        Modifier.setBlockData(
            editorState.getCurrentContent(),
            editorState.getSelection(),
            blockData
        ),
        'change-block-data'
    );
}

/**
 * 
 */
export const insertText = (editorState, contentState, selection, text) => {
    return EditorState.push(
        editorState,
        Modifier.insertText(contentState, selection, text),
        'insert-characters'
    );
}

/**
 * 
 */
export const replaceWithFragment = (editorState, contentState, selection, blocks) => {
    return EditorState.push(
        editorState,
        Modifier.replaceWithFragment(
            contentState,
            selection,
            BlockMapBuilder.createFromArray(blocks)
        ),
        'insert-fragment'
    );
}

export const pushContentStateFromArray = (editorState, contentBlocks) => {
    return EditorState.push(
        editorState,
        ContentState.createFromBlockArray(contentBlocks),
        'apply-entity'
    );
}

/**
 * Return a new selection by merging the outdentation offset.
 */
export const mergeOutdentSelection = (selection) => {
    return selection.merge({
        anchorOffset: selection.getAnchorOffset() - 1,
        focusOffset: selection.getFocusOffset() - 1,
    });
}

/**
 * Return a new selection by merging the indentation offset.
 * 
 * The function will always keep the start of the selection
 * of the first row when it starts at 0
 */
export const mergeIndentSelection = (selection) => {
    let anchorOffset = selection.getAnchorOffset();
    let focusOffset = selection.getFocusOffset();

    if (selection.getIsBackward()) {
        if (focusOffset !== 0) {
            focusOffset += 1;
        }

        if (anchorOffset !== 0) {
            anchorOffset += 1;
        }
    }

    if (!selection.getIsBackward()) {
        focusOffset += 1;

        if (anchorOffset !== 0) {
            anchorOffset += 1;
        }
    }

    return selection.merge({ anchorOffset, focusOffset });
}

export const cloneContentBlock = (contentBlock, text) => {
    return new ContentBlock({
        key: contentBlock.getKey(),
        type: contentBlock.getType(),
        data: contentBlock.getData(),
        text,
    });
}

/**
 * 
 */
export const indentBlock = (
    editorState,
    contentState,
    selection,
    blockKey,
) => {
    const contentBlock = contentState.getBlockForKey(blockKey);
    // recover only the text of the selection to avoid
    // ending up with additional text when inserting
    const endText = contentBlock.getText()
        .substr(selection.getStartOffset(), selection.getEndOffset());

    const text = selection.getStartOffset() !== 0 ? '\t' : `\t${endText}`;

    return EditorState.acceptSelection(
        replaceWithFragment(
            editorState,
            contentState,
            selection,
            [cloneContentBlock(contentBlock, text)]
        ),
        mergeIndentSelection(selection)
    );
}

/**
 * 
 */
export const indentBlocksForKeys = (
    editorState,
    selection,
    contentState,
    blockKeys
) => {
    const contentBlocks = contentState
        .getBlocksAsArray()
        .map(contentBlock => {
            if (blockKeys.includes(contentBlock.getKey())) {
                return cloneContentBlock(contentBlock, `\t${contentBlock.getText()}`);
            }

            return contentBlock;
        });

    return EditorState.acceptSelection(
        pushContentStateFromArray(
            editorState,
            contentBlocks
        ),
        mergeIndentSelection(selection)
    );
}

/**
 * 
 */
export const indentSelection = (editorState, contentState) => {
    const selection = editorState.getSelection();
    const startKey = selection.getStartKey();
    const endKey = selection.getEndKey();

    if (!selection.isCollapsed()) {
        if (startKey === endKey) {
            return indentBlock(
                editorState,
                contentState,
                selection,
                startKey
            );
        }

        return indentBlocksForKeys(
            editorState,
            selection,
            contentState,
            getBlocksKeysBetween(contentState, startKey, endKey)
        );
    }

    return insertText(editorState, contentState, selection, '\t');
}

/**
 *
 */
export const outdentBlocksForKeys = (
    editorState,
    selection,
    contentState,
    blockKeys
) => {
    const contentBlocks = contentState
        .getBlocksAsArray()
        .map(contentBlock => {
            if (blockKeys.includes(contentBlock.getKey()) && contentBlock.getText().substr(0, 1) === '\t') {
                return cloneContentBlock(contentBlock, `${contentBlock.getText().substr(1)}`);
            }

            return contentBlock;
        });

    return EditorState.acceptSelection(
        pushContentStateFromArray(
            editorState,
            contentBlocks
        ),
        mergeOutdentSelection(selection)
    );
}

/**
 * 
 */
export const outdentSelection = (editorState, contentState) => {
    const selection = editorState.getSelection();
    const startKey = selection.getStartKey();
    const endKey = selection.getEndKey();

    return outdentBlocksForKeys(
        editorState,
        selection,
        contentState,
        getBlocksKeysBetween(contentState, startKey, endKey)
    );
}

/**
 * 
 */
export const mergeBlockData = (editorState, contentState, blockKey) => {
    const blockData = getBlockDataForKey(contentState, blockKey);
    const selection = editorState.getSelection();

    if (!blockData || !selection.isCollapsed()) {
        return editorState;
    }

    const splitState = EditorState.push(
        editorState,
        Modifier.splitBlock(contentState, selection),
        'split-block'
    );

    return EditorState.push(
        editorState,
        Modifier.mergeBlockData(
            splitState.getCurrentContent(),
            splitState.getSelection(),
            blockData
        ),
        'split-block'
    );
}