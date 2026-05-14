package com.psap.palletisation.controller;

import com.psap.palletisation.dto.response.UploadResponse;
import com.psap.palletisation.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class UploadController {

    private final ParserService parserService;

    public UploadController(ParserService parserService) {
        this.parserService = parserService;
    }

    @PostMapping("/upload")
    public ResponseEntity<UploadResponse> upload(@RequestParam("file") MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No filename provided");
        }

        String lower = filename.toLowerCase();
        if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")
                && !lower.endsWith(".xls") && !lower.endsWith(".json")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported file type. Use: .csv, .xlsx, .xls, .json");
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read file");
        }

        ParserService.ParseResult result = parserService.parseFile(content, filename);
        if (result.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    result.warnings().isEmpty() ? "No valid order rows found" : result.warnings().get(0));
        }

        UploadResponse response = new UploadResponse();
        response.setFilename(filename);
        response.setRowsParsed(result.items().size());
        response.setItems(result.items());
        response.setWarnings(result.warnings());
        return ResponseEntity.ok(response);
    }
}
