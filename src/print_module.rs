use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrintCursor {
    pub section_index: usize,
    pub paragraph_index: usize,
    pub control_index: Option<usize>,
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
    pub cursor: PrintCursor,
}

impl PrintTaskState {
    pub fn new() -> Self {
        Self {
            cursor: PrintCursor::default(),
        }
    }
}
