use serde::{Deserialize, Serialize};

use crate::renderer::pagination::PageItem;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrintCursor {
    pub section_index: usize,
    pub paragraph_index: usize,
    pub control_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PrintRangeRequest {
    All,
    CurrentPage {
        page: usize,
    },
    PageRange {
        start: usize,
        end: usize,
    },
}

impl Default for PrintRangeRequest {
    fn default() -> Self {
        Self::All
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "itemType", rename_all = "camelCase")]
pub enum PrintTargetKind {
    FullParagraph,
    PartialParagraph {
        start_line: usize,
        end_line: usize,
    },
    Table {
        control_index: usize,
    },
    PartialTable {
        control_index: usize,
        start_row: usize,
        end_row: usize,
        is_continuation: bool,
        split_start_content_offset: f64,
        split_end_content_limit: f64,
    },
    Shape {
        control_index: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintTargetEntry {
    pub page_index: usize,
    pub section_index: usize,
    pub column_index: usize,
    pub paragraph_index: usize,
    pub control_index: Option<usize>,
    pub kind: PrintTargetKind,
}

impl PrintTargetEntry {
    pub fn from_page_item(
        page_index: usize,
        section_index: usize,
        column_index: usize,
        item: &PageItem,
    ) -> Self {
        match item {
            PageItem::FullParagraph { para_index } => Self {
                page_index,
                section_index,
                column_index,
                paragraph_index: *para_index,
                control_index: None,
                kind: PrintTargetKind::FullParagraph,
            },
            PageItem::PartialParagraph {
                para_index,
                start_line,
                end_line,
            } => Self {
                page_index,
                section_index,
                column_index,
                paragraph_index: *para_index,
                control_index: None,
                kind: PrintTargetKind::PartialParagraph {
                    start_line: *start_line,
                    end_line: *end_line,
                },
            },
            PageItem::Table {
                para_index,
                control_index,
            } => Self {
                page_index,
                section_index,
                column_index,
                paragraph_index: *para_index,
                control_index: Some(*control_index),
                kind: PrintTargetKind::Table {
                    control_index: *control_index,
                },
            },
            PageItem::PartialTable {
                para_index,
                control_index,
                start_row,
                end_row,
                is_continuation,
                split_start_content_offset,
                split_end_content_limit,
            } => Self {
                page_index,
                section_index,
                column_index,
                paragraph_index: *para_index,
                control_index: Some(*control_index),
                kind: PrintTargetKind::PartialTable {
                    control_index: *control_index,
                    start_row: *start_row,
                    end_row: *end_row,
                    is_continuation: *is_continuation,
                    split_start_content_offset: *split_start_content_offset,
                    split_end_content_limit: *split_end_content_limit,
                },
            },
            PageItem::Shape {
                para_index,
                control_index,
            } => Self {
                page_index,
                section_index,
                column_index,
                paragraph_index: *para_index,
                control_index: Some(*control_index),
                kind: PrintTargetKind::Shape {
                    control_index: *control_index,
                },
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PrintBlock {
    Paragraph {
        html: String,
        section_index: usize,
        paragraph_index: usize,
    },
    Table {
        html: String,
        section_index: usize,
        paragraph_index: usize,
        control_index: usize,
    },
    Image {
        src: String,
        alt: String,
        mime: Option<String>,
        section_index: usize,
        paragraph_index: usize,
        control_index: usize,
    },
    PageBreak {
        section_index: usize,
        paragraph_index: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrintChunk {
    pub done: bool,
    pub next_cursor: Option<PrintCursor>,
    pub blocks: Vec<PrintBlock>,
}

#[derive(Debug, Clone, Default)]
pub struct PrintTaskState {
    pub range: PrintRangeRequest,
    pub entries: Vec<PrintTargetEntry>,
    pub current_entry_index: usize,
}

impl PrintTaskState {
    pub fn new() -> Self {
        Self {
            range: PrintRangeRequest::default(),
            entries: Vec::new(),
            current_entry_index: 0,
        }
    }
}
